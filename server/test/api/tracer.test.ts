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
      return { response, body: await response.json() };
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

    // TODO(handoff): bridge.start(bridgePort) with game null, expect 503 no_game, then sendGame(GBA_GAME) and check status and party.
  });
});
