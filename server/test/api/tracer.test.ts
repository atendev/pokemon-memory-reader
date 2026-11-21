import { afterEach, describe, expect, test } from "bun:test";
import {
  ErrorBody,
  Party,
  StatusResource,
} from "@pokemon-memory-reader/api/schemas";
import { createBridgeAdapter } from "../../src/adapter/bridge/adapter";
import { systemClock } from "../../src/clock";
import { Bytes } from "../../src/format/bytes";
import { gen3Party } from "../../src/format/gen3/party";
import { silentLog } from "../../src/log";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import { referenceData } from "../../src/reference";
import { type RunningServer, startServer } from "../../src/server";
import { FakeBridge, GBA_GAME } from "../bridge/fake-bridge";
import { emeraldMemory, serve, TREECKO } from "../support/emerald-memory";
import { ALL_SUPPORTED } from "../support/supported";

const { registry } = loadProfiles({ builtin: [emerald], user: [] });

const running: { stop(): Promise<void> | void }[] = [];
afterEach(async () => {
  for (const item of running.splice(0).reverse()) await item.stop();
});

async function until(
  condition: () => Promise<boolean>,
  what: string,
  ms = 3000,
): Promise<void> {
  const deadline = Date.now() + ms;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** A server wired to the real bridge adapter, with the bridge not yet listening on its port. */
function setup(): {
  server: RunningServer;
  bridge: FakeBridge;
  bridgePort: number;
  url: string;
} {
  const bridge = new FakeBridge();
  bridge.start();
  const port = bridge.port;
  bridge.stop();
  bridge.game = null;
  bridge.onRead = (read, socket) =>
    bridge.reply(socket, read.id, serve(memory, read.ranges));
  const adapter = createBridgeAdapter(
    "mgba",
    { host: "127.0.0.1", port },
    { clock: systemClock, log: silentLog },
    { baseBackoffMs: 10, maxBackoffMs: 20 },
  );
  adapter.setMode("live");
  const server = startServer({
    supported: ALL_SUPPORTED,
    adapter,
    registry,
    port: 0,
    pollHz: 60,
    log: silentLog,
  });
  running.push(bridge, { stop: () => adapter.close() }, server);
  return {
    server,
    bridge,
    bridgePort: port,
    url: `http://127.0.0.1:${server.port}/api/v2`,
  };
}

let memory = emeraldMemory([TREECKO]);

describe("tracer API against the fake bridge", () => {
  test("a 503 before a game loads, then a valid status and the expected party", async () => {
    memory = emeraldMemory([TREECKO]);
    const { bridge, bridgePort, url } = setup();
    const getJson = async (path: string) => {
      const response = await fetch(`${url}${path}`);
      return { response, body: (await response.json()) as { state?: string } };
    };

    // No bridge is listening: nothing usable.
    const offline = await getJson("/party");
    expect(offline.response.status).toBe(503);
    const refusal = ErrorBody.parse(offline.body);
    expect(refusal.error.code).toBe("disconnected");
    expect(refusal.status.state).toBe("disconnected");
    expect(refusal.status.rom).toBeNull();
    expect(offline.response.headers.get("access-control-allow-origin")).toBe(
      "*",
    );

    // The bridge is up but has no ROM yet.
    bridge.game = null;
    bridge.start(bridgePort);
    await until(
      async () => (await getJson("/status")).body.state === "no_game",
      "state no_game",
    );
    const empty = await getJson("/party");
    expect(empty.response.status).toBe(503);
    expect(ErrorBody.parse(empty.body).error.code).toBe("no_game");

    // A game loads.
    // The mGBA bridge sends CRC32 only (amendment 014 §7). This is Emerald US 1.0's.
    bridge.sendGame({ ...GBA_GAME, crc32: "1f1c08fb", sha1: null });
    await until(
      async () => (await getJson("/status")).body.state === "game",
      "state game",
    );
    const status = StatusResource.parse((await getJson("/status")).body);
    expect(status.rom).toMatchObject({
      platform: "gba",
      title: "POKEMON EMER",
      gameCode: "BPEE",
      revision: 0,
      crc32: "1f1c08fb",
      sha1: null,
      contentName: null,
    });
    expect(status.game).toMatchObject({
      profileId: "emerald-us-1.0",
      generation: 3,
      dataFormat: "gen3",
      match: "exact",
      signature: "match",
    });
    expect(status.adapter).toMatchObject({ id: "mgba", problem: null });

    const party = await getJson("/party");
    expect(party.response.status).toBe(200);
    const parsed = Party.parse(party.body);
    expect(parsed.pokemon).toHaveLength(1);
    expect(parsed.pokemon[0]).toMatchObject({
      species: { id: TREECKO.species, name: "TREECKO" },
      nickname: TREECKO.nickname,
      level: TREECKO.level,
      hp: TREECKO.hp,
      maxHp: TREECKO.maxHp,
      ot: { name: TREECKO.otName, id: TREECKO.tid, secretId: TREECKO.sid },
    });
    expect(parsed.pokemon[0]?.moves.map((m) => m?.id)).toEqual([33, 52]);

    // An unknown route gets the same error shape, with the status attached.
    const missing = await getJson("/nope");
    expect(missing.response.status).toBe(404);
    expect(ErrorBody.parse(missing.body).error.code).toBe("not_found");

    // The same bytes through the decoder directly give the same party.
    const reference = referenceData("gen3", "en");
    const profile = registry.get("emerald-us-1.0");
    if (!reference || profile?.dataFormat !== "gen3")
      throw new Error("Emerald fixtures missing");
    const direct = gen3Party.decode(
      {
        count: new Bytes(Uint8Array.of(1)),
        party: new Bytes(memory.ewram.subarray(0x244ec, 0x244ec + 600)),
      },
      {
        profile,
        ...reference,
        names: {
          ...reference.names,
          locations: reference.locations(profile.artVersion),
        },
      },
    );
    expect(direct.ok && direct.value).toEqual(parsed);
  });

  async function statusAfter(game: Record<string, unknown>) {
    const { bridge, bridgePort, url } = setup();
    bridge.game = null;
    bridge.start(bridgePort);
    const getStatus = async () =>
      StatusResource.parse(await (await fetch(`${url}/status`)).json());
    await until(async () => (await getStatus()).state === "no_game", "no_game");
    bridge.sendGame(game);
    await until(
      async () => (await getStatus()).state !== "no_game",
      "identification",
    );
    return getStatus();
  }

  test("status.adapter.stalled turns true after 1 s of unanswered reads and clears on a good one", async () => {
    memory = emeraldMemory([TREECKO]);
    const { bridge, bridgePort, url } = setup();
    bridge.game = null;
    bridge.start(bridgePort);
    const getStatus = async () =>
      StatusResource.parse(await (await fetch(`${url}/status`)).json());
    const stalled = async () => (await getStatus()).adapter?.stalled;
    await until(async () => (await getStatus()).state === "no_game", "no_game");
    bridge.sendGame({ ...GBA_GAME, crc32: "1f1c08fb", sha1: null });
    await until(async () => (await getStatus()).state === "game", "game");
    expect(await stalled()).toBe(false);

    // The bridge goes quiet. Each read times out after 250 ms, so the flag flips within about 1.3 s.
    const unanswered: Parameters<typeof bridge.onRead>[] = [];
    const answer = bridge.onRead;
    bridge.onRead = (...args) => {
      unanswered.push(args);
    };
    await until(async () => (await stalled()) === true, "stalled", 5000);

    // It answers again. The held requests get their late replies, which are discarded.
    bridge.onRead = answer;
    for (const args of unanswered) answer(...args);
    await until(async () => (await stalled()) === false, "stalled cleared");
  }, 15000);

  test("with no hash, a header and signature match loads by header", async () => {
    memory = emeraldMemory([TREECKO]);
    const status = await statusAfter({ ...GBA_GAME, crc32: null });
    expect(status.state).toBe("game");
    expect(status.game).toMatchObject({ match: "header", signature: "match" });
  });

  test("a hash that matches no profile is a modified ROM and stays unidentified", async () => {
    memory = emeraldMemory([TREECKO]);
    const status = await statusAfter(GBA_GAME);
    expect(status.state).toBe("unidentified");
    expect(status.game).toBeNull();
    expect(status.rom).toMatchObject({ crc32: "1a2b3c4d", gameCode: "BPEE" });
  });

  test("a hash match with a wrong signature still loads and reports the mismatch", async () => {
    memory = emeraldMemory([TREECKO]);
    memory.rom.set([0, 0, 0, 0], 0x1bc);
    const status = await statusAfter({ ...GBA_GAME, crc32: "1f1c08fb" });
    expect(status.game).toMatchObject({
      match: "exact",
      signature: "mismatch",
    });
  });

  test("a header match with a wrong signature is unidentified", async () => {
    memory = emeraldMemory([TREECKO]);
    memory.rom.set([0, 0, 0, 0], 0x1bc);
    const status = await statusAfter({ ...GBA_GAME, crc32: null });
    expect(status.state).toBe("unidentified");
  });
});
