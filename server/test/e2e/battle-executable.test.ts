import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { FakeBridge } from "../bridge/fake-bridge";
import { type BattleMonSpec, writeBattle } from "../gen3/battle-encode";
import { emeraldMemory, serve, TREECKO } from "../support/emerald-memory";

/**
 * Runs the compiled executable against the fake bridge with a synthetic wild battle in memory, and
 * checks the `battle` resource and the Battle screen's code in the served viewer. It needs a built
 * executable, so it runs only when `PMR_EXECUTABLE` names one (the compile-smoke CI job sets it).
 */
const executable = process.env.PMR_EXECUTABLE;
const suite = executable ? describe : describe.skip;

const POOCHYENA = 261;
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

  test("serves a viewer that carries the Battle screen", async () => {
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
  });
});
