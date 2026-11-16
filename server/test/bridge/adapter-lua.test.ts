import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createBridgeAdapter } from "../../src/adapter/bridge/adapter";
import type { ManagedAdapter } from "../../src/adapter/types";
import { silentLog } from "../../src/log";
import { expectedBytes, LuaBridge } from "./lua-bridge";
import { ManualClock } from "./manual-clock";

const LOAD_GBA =
  "load gba 1a2b3c4d - Emerald rom=1048576 ewram=262144 iwram=32768";

let bridge: LuaBridge;
let adapter: ManagedAdapter;
let clock: ManualClock;

beforeEach(async () => {
  bridge = new LuaBridge();
  clock = new ManualClock();
  await bridge.start();
  await bridge.command(LOAD_GBA);
  adapter = createBridgeAdapter(
    "mgba",
    { host: "127.0.0.1", port: bridge.port },
    { clock, log: silentLog },
  );
  adapter.setMode("live");
});

afterEach(async () => {
  await adapter.close();
  await bridge.stop();
});

async function until(condition: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + 3000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 2));
  }
}

// The adapter and the real Lua protocol core, over real TCP.
describe("the adapter against the Lua core", () => {
  test("connects, reads batched ranges and follows a ROM change", async () => {
    await until(() => adapter.state.game !== null, "the game message");
    expect(adapter.state.bridge).toMatchObject({
      bridge: "mgba",
      build: "test-build",
    });
    expect(adapter.state.game?.domains).toEqual({
      rom: 1048576,
      ewram: 262144,
      iwram: 32768,
    });

    const outcome = await adapter.read(
      [
        { domain: "ewram", offset: 0x40, length: 16 },
        { domain: "iwram", offset: 0, length: 4 },
        { domain: "rom", offset: 0xac, length: 4 },
      ],
      1000,
    );
    expect(outcome).toEqual({
      kind: "data",
      slices: [
        expectedBytes("ewram", 0x40, 16),
        expectedBytes("iwram", 0, 4),
        expectedBytes("rom", 0xac, 4),
      ],
    });

    const epoch = adapter.state.gameEpoch;
    await bridge.command(
      "load gba deadbeef - Ruby rom=2097152 ewram=262144 iwram=32768",
    );
    await until(() => adapter.state.gameEpoch > epoch, "the ROM change");
    expect(adapter.state.game?.crc32).toBe("deadbeef");
    expect(adapter.state.game?.domains.rom).toBe(2097152);

    await bridge.command("unload");
    await until(() => adapter.state.game === null, "the unload");
    expect(
      await adapter.read([{ domain: "ewram", offset: 0, length: 1 }], 1000),
    ).toEqual({ kind: "failed", reason: "no_game" });
  });

  test("reads a 150,000 byte rom range as three requests that add up", async () => {
    await until(() => adapter.state.game !== null, "the game message");
    const outcome = await adapter.read(
      [{ domain: "rom", offset: 512, length: 150_000 }],
      2000,
    );
    expect(outcome.kind).toBe("data");
    if (outcome.kind === "data") {
      expect(outcome.slices[0]).toEqual(expectedBytes("rom", 512, 150_000));
    }
  });

  test("a Lua error inside a read comes back as bridge_error and the connection survives", async () => {
    await until(() => adapter.state.game !== null, "the game message");
    await bridge.command("failread");
    expect(
      await adapter.read([{ domain: "ewram", offset: 0, length: 4 }], 1000),
    ).toEqual({ kind: "failed", reason: "bridge_error" });
    const again = await adapter.read(
      [{ domain: "ewram", offset: 0, length: 4 }],
      1000,
    );
    expect(again.kind).toBe("data");
  });

  test("reconnects after the Lua core drops the client", async () => {
    await until(() => adapter.state.game !== null, "the game message");
    await bridge.command("failreceive");
    await until(() => adapter.state.connection === "disconnected", "the close");
    clock.advance(500);
    await until(
      () =>
        adapter.state.connection === "connected" && adapter.state.game !== null,
      "the reconnect",
    );
    const outcome = await adapter.read(
      [{ domain: "ewram", offset: 0, length: 4 }],
      1000,
    );
    expect(outcome.kind).toBe("data");
  });
});

describe("a second adapter against one Lua core", () => {
  test("is told busy and the first keeps working", async () => {
    await until(() => adapter.state.game !== null, "the game message");
    const second = createBridgeAdapter(
      "mgba",
      { host: "127.0.0.1", port: bridge.port },
      { clock: new ManualClock(), log: silentLog },
    );
    second.setMode("hold");
    try {
      await until(() => second.state.problem === "busy", "the busy problem");
      expect(second.state.bridge?.bridge).toBe("mgba");
      const outcome = await adapter.read(
        [{ domain: "ewram", offset: 0, length: 4 }],
        1000,
      );
      expect(outcome.kind).toBe("data");
    } finally {
      await second.close();
    }
  });
});
