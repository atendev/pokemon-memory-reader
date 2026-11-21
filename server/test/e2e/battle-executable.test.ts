import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { FakeBridge, GBA_GAME } from "../bridge/fake-bridge";
import { type BattleMonSpec, writeBattle } from "../gen3/battle-encode";
import { encodeMon, storageBytes } from "../gen3/encode";
import { emeraldMemory, serve, TREECKO } from "../support/emerald-memory";

/**
 * Runs the compiled executable against the fake bridge with a synthetic wild battle and PC box in
 * memory, and checks the `battle` and `boxes` resources and the Battle and Boxes screens' code in
 * the served viewer. It needs a built
 * executable, so it runs only when `PMR_EXECUTABLE` names one (the compile-smoke CI job sets it).
 */
const executable = process.env.PMR_EXECUTABLE;
const suite = executable ? describe : describe.skip;

/** Emerald US 1.0's real CRC32, so the game identifies as vanilla rather than modified. */
const EMERALD_CRC32 = "1f1c08fb";
const POOCHYENA = 261;
/** gPokemonStorage is a pointer word at IWRAM 0x5d94. The block sits above the battle structs, which end near 0x25000. */
const STORAGE_POINTER = 0x5d94;
const STORAGE_AT = 0x30000;
const wildMon: BattleMonSpec = {
  species: POOCHYENA,
  level: 3,
  hp: 12,
  maxHp: 12,
  moves: [33],
  pp: [35],
  types: [0, 0],
};
const player: BattleMonSpec = {
  species: 277,
  level: 5,
  hp: 19,
  maxHp: 20,
  moves: [33],
  pp: [30],
  types: [12, 12],
};

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() =>
        typeof address === "object" && address
          ? resolvePort(address.port)
          : reject(new Error("no port")),
      );
    });
  });
}

suite("the compiled executable on the fake bridge", () => {
  const bridge = new FakeBridge();
  let child: Bun.Subprocess | null = null;
  let dataDir = "";
  let base = "";

  beforeAll(async () => {
    const memory = emeraldMemory([TREECKO]);
    writeBattle(memory, {
      typeFlags: 0,
      battlers: [player, wildMon],
      partyIndexes: [0, 0],
      enemyParty: [{ ...TREECKO, species: POOCHYENA, level: 3, nickname: "" }],
    });
    memory.ewram.set(
      storageBytes({
        currentBox: 1,
        slots: { 1: { 2: encodeMon({ ...TREECKO, nickname: "BOXED" }) } },
        names: { 1: "LEAFBOX" },
      }),
      STORAGE_AT,
    );
    new DataView(memory.iwram.buffer).setUint32(
      STORAGE_POINTER,
      0x02000000 + STORAGE_AT,
      true,
    );
    bridge.game = { ...GBA_GAME, crc32: EMERALD_CRC32 };
    bridge.onRead = (read, socket) =>
      bridge.reply(socket, read.id, serve(memory, read.ranges));
    bridge.start();
    dataDir = await mkdtemp(join(tmpdir(), "pmr-battle-e2e-"));
    await writeFile(
      join(dataDir, "config.json"),
      JSON.stringify({
        version: 1,
        adapters: { mgba: { host: "127.0.0.1", port: bridge.port } },
      }),
    );
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    child = Bun.spawn(
      [
        resolve(executable as string),
        "--no-browser",
        "--port",
        String(port),
        "--data-dir",
        dataDir,
      ],
      { stdout: "ignore", stderr: "ignore" },
    );
  });

  afterAll(async () => {
    child?.kill("SIGKILL");
    bridge.stop();
    await rm(dataDir, { recursive: true, force: true });
  });

  test("serves the active battle the fake bridge holds", async () => {
    const deadline = Date.now() + 20_000;
    let body: {
      active?: boolean;
      opponent?: { active: { species: { id: number } }[] };
    } = {};
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`${base}/api/v2/battle`);
        if (response.ok) {
          body = (await response.json()) as typeof body;
          if (body.active) break;
        }
      } catch {}
      await Bun.sleep(100);
    }
    expect(body.active).toBe(true);
    expect(body.opponent?.active[0]?.species.id).toBe(POOCHYENA);
  }, 30_000);

  test("serves the boxes the fake bridge holds, whole and one at a time", async () => {
    type BoxBody = {
      index: number;
      name: string | null;
      readable: boolean;
      slots: ({ nickname: string | null } | null)[];
    };
    const deadline = Date.now() + 20_000;
    const fetchWhole = async () => {
      try {
        const response = await fetch(`${base}/api/v2/boxes`);
        if (response.ok) {
          return (await response.json()) as {
            currentBox: number | null;
            boxes: BoxBody[];
          };
        }
      } catch {}
      return null;
    };
    let whole = await fetchWhole();
    while (whole === null && Date.now() < deadline) {
      await Bun.sleep(100);
      whole = await fetchWhole();
    }
    expect(whole?.currentBox).toBe(1);
    expect(whole?.boxes).toHaveLength(14);
    expect(whole?.boxes[1]?.name).toBe("LEAFBOX");
    expect(whole?.boxes[1]?.slots[2]?.nickname).toBe("BOXED");
    const one = (await (
      await fetch(`${base}/api/v2/boxes/1`)
    ).json()) as BoxBody;
    expect(one.index).toBe(1);
    expect(one.slots[2]?.nickname).toBe("BOXED");
  }, 30_000);

  test("serves a viewer that carries the Battle and Boxes screens", async () => {
    const html = await (await fetch(`${base}/`)).text();
    const assets = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map(
      (m) => m[1] as string,
    );
    expect(assets.length).toBeGreaterThan(0);
    const code = (
      await Promise.all(
        assets.map(async (path) => (await fetch(`${base}${path}`)).text()),
      )
    ).join("\n");
    expect(code).toContain("Wild encounter");
    expect(code).toContain("Show unrevealed opponent Pokémon");
    expect(code).not.toContain("This screen isn't built yet.Battle");
    expect(code).toContain("Reading the boxes");
    expect(code).toContain("marked corrupt");
    expect(code).toContain("only as fresh as the last in-game save");
  });
});
