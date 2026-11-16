import { afterEach, describe, expect, test } from "bun:test";
import { createBridgeAdapter } from "../../src/adapter/bridge/adapter";
import { FRAME_KIND, PROTOCOL } from "../../src/adapter/bridge/constants";
import { encodeFrame } from "../../src/adapter/bridge/wire";
import type {
  AdapterState,
  ManagedAdapter,
  Range,
} from "../../src/adapter/types";
import type { Log } from "../../src/log";
import { FakeBridge, GBA_GAME, HELLO } from "./fake-bridge";
import { expectedBytes } from "./lua-bridge";
import { ManualClock } from "./manual-clock";

const EWRAM: Range = { domain: "ewram", offset: 0x100, length: 4 };
const IWRAM: Range = { domain: "iwram", offset: 0x20, length: 8 };

const fakes: FakeBridge[] = [];
const adapters: ManagedAdapter[] = [];

afterEach(async () => {
  for (const adapter of adapters.splice(0)) await adapter.close();
  for (const fake of fakes.splice(0)) fake.stop();
});

async function until(
  condition: () => boolean,
  what = "the condition",
  ms = 2000,
): Promise<void> {
  const deadline = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 2));
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function startFake(): FakeBridge {
  const fake = new FakeBridge();
  fake.start();
  fakes.push(fake);
  return fake;
}

function makeLog() {
  const lines: string[] = [];
  const log: Log = {
    debug() {},
    info() {},
    warn: (m) => void lines.push(m),
    error: (m) => void lines.push(m),
  };
  return { log, lines };
}

function makeAdapter(
  port: number,
  mode: "probe" | "hold" | "live" = "live",
  bridge: "mgba" | "bizhawk" = "mgba",
) {
  const clock = new ManualClock();
  const { log, lines } = makeLog();
  const adapter = createBridgeAdapter(
    bridge,
    { host: "127.0.0.1", port },
    { clock, log },
  );
  adapters.push(adapter);
  adapter.setMode(mode);
  const states: AdapterState[] = [];
  adapter.subscribe((s) => void states.push(s));
  return { adapter, clock, lines, states };
}

/** A connected live adapter with its first game message in. */
async function live() {
  const fake = startFake();
  const made = makeAdapter(fake.port);
  await until(() => made.adapter.state.game !== null, "the game message");
  return { fake, ...made };
}

function sliceOf(outcome: Awaited<ReturnType<ManagedAdapter["read"]>>) {
  if (outcome.kind !== "data") throw new Error(`got ${outcome.kind}`);
  return outcome.slices;
}

describe("connect", () => {
  test("takes the hello and the game message, then serves a batched read", async () => {
    const { adapter, fake } = await live();
    expect(adapter.state.connection).toBe("connected");
    expect(adapter.state.problem).toBeNull();
    expect(adapter.state.bridge).toEqual({
      bridge: "mgba",
      protocol: PROTOCOL,
      build: "test-build",
      emulator: { name: "FakeEmu", version: null },
    });
    expect(adapter.state.game).toEqual({
      platform: "gba",
      romName: "Emerald",
      crc32: "1a2b3c4d",
      sha1: null,
      domains: { rom: 1048576, ewram: 262144, iwram: 32768 },
    });
    expect(adapter.state.gameEpoch).toBe(1);

    const slices = sliceOf(await adapter.read([EWRAM, IWRAM], 250));
    expect(slices).toEqual([
      expectedBytes("ewram", 0x100, 4),
      expectedBytes("iwram", 0x20, 8),
    ]);
    expect(fake.reads).toHaveLength(1);
    expect(fake.reads[0]?.id).toBe(1);
    expect(fake.reads[0]?.ranges).toHaveLength(2);
  });

  test("a probe closes right after the hello", async () => {
    const fake = startFake();
    const { adapter } = makeAdapter(fake.port, "probe");
    await until(() => adapter.state.bridge !== null, "the hello");
    await until(() => fake.open === 0, "the probe to close");
    expect(adapter.state.problem).toBeNull();
    expect(adapter.state.connection).toBe("disconnected");
  });

  test("a selector that goes live inside the listener keeps the connection", async () => {
    const fake = startFake();
    const { adapter } = makeAdapter(fake.port, "probe");
    adapter.subscribe((s) => {
      if (s.bridge !== null && s.problem === null) adapter.setMode("live");
    });
    await until(() => adapter.state.game !== null, "the game message");
    expect(fake.open).toBe(1);
    expect(sliceOf(await adapter.read([EWRAM], 250))).toHaveLength(1);
  });

  test("a read before the mode is live fails as disconnected", async () => {
    const fake = startFake();
    const { adapter } = makeAdapter(fake.port, "probe");
    await until(() => adapter.state.bridge !== null, "the hello");
    expect(await adapter.read([EWRAM], 250)).toEqual({
      kind: "failed",
      reason: "disconnected",
    });
  });

  test("a read overlapping another rejects", async () => {
    const { adapter, fake } = await live();
    fake.onRead = () => {};
    const first = adapter.read([EWRAM], 250);
    await expect(adapter.read([EWRAM], 250)).rejects.toThrow(
      "one read at a time",
    );
    void first;
  });
});

describe("hello", () => {
  const WRONG_PROTOCOL = { bridge: "mgba", protocol: 2, somethingNew: true };

  test("a protocol mismatch sends nothing, and a probe closes", async () => {
    const fake = startFake();
    fake.hello = WRONG_PROTOCOL;
    const { adapter } = makeAdapter(fake.port, "probe");
    await until(() => adapter.state.problem !== null, "the problem");
    expect(adapter.state.problem).toBe("protocol_mismatch");
    // Only bridge and protocol are copied, even though the hello was not valid (spec §4.7).
    expect(adapter.state.bridge).toEqual({
      bridge: "mgba",
      protocol: 2,
      build: null,
      emulator: null,
    });
    await until(() => fake.open === 0, "the probe to close");
    expect(fake.reads).toHaveLength(0);
  });

  test("hold keeps a protocol mismatch connection open and idle", async () => {
    const fake = startFake();
    fake.hello = WRONG_PROTOCOL;
    const { adapter } = makeAdapter(fake.port, "hold");
    await until(() => adapter.state.problem === "protocol_mismatch");
    await sleep(40);
    expect(fake.open).toBe(1);
    expect(fake.connections).toBe(1);
    expect(fake.reads).toHaveLength(0);
    expect(await adapter.read([EWRAM], 250)).toEqual({
      kind: "failed",
      reason: "disconnected",
    });
  });

  test("a live adapter closes on a protocol mismatch and reconnects with backoff", async () => {
    const fake = startFake();
    fake.hello = WRONG_PROTOCOL;
    const { adapter, clock } = makeAdapter(fake.port, "live");
    await until(() => adapter.state.problem === "protocol_mismatch");
    await until(() => fake.open === 0, "the close");
    expect(fake.connections).toBe(1);
    // The user reloads a matching bridge.
    fake.hello = HELLO;
    await until(() => adapter.state.connection === "disconnected");
    clock.advance(500);
    await until(() => adapter.state.game !== null, "the new game message");
    expect(adapter.state.problem).toBeNull();
    expect(fake.connections).toBe(2);
  });

  test("a hello that fails strict validation is unknown_bridge", async () => {
    const fake = startFake();
    fake.hello = { bridge: "mgba", protocol: PROTOCOL };
    const { adapter } = makeAdapter(fake.port);
    await until(() => adapter.state.problem === "unknown_bridge");
    expect(adapter.state.bridge).toBeNull();
    await until(() => fake.open === 0, "the close");
  });

  test("a first frame that is not a hello is unknown_bridge", async () => {
    const fake = startFake();
    fake.hello = null;
    const { adapter } = makeAdapter(fake.port);
    await until(() => fake.open === 1);
    fake.sendGame(GBA_GAME);
    await until(() => adapter.state.problem === "unknown_bridge");
    await until(() => fake.open === 0, "the close");
  });

  test("a hello from another bridge is unknown_bridge and names it", async () => {
    const fake = startFake();
    fake.hello = { ...HELLO, bridge: "bizhawk" };
    const { adapter, lines } = makeAdapter(fake.port);
    await until(() => adapter.state.problem === "unknown_bridge");
    expect(adapter.state.bridge?.bridge).toBe("bizhawk");
    await until(() => fake.open === 0, "the close");
    expect(lines.some((l) => l.includes("different bridge"))).toBe(true);
    expect(fake.reads).toHaveLength(0);
  });

  test("no hello in 3 s is unknown_bridge, the socket stays open, and a late hello clears it", async () => {
    const fake = startFake();
    fake.hello = null;
    const { adapter, clock } = makeAdapter(fake.port);
    await until(() => fake.open === 1);
    clock.advance(2999);
    expect(adapter.state.problem).toBeNull();
    clock.advance(1);
    expect(adapter.state.problem).toBe("unknown_bridge");
    await sleep(30);
    expect(fake.open).toBe(1);
    fake.sendHello(HELLO);
    fake.sendGame(GBA_GAME);
    await until(() => adapter.state.game !== null);
    expect(adapter.state.problem).toBeNull();
    expect(adapter.state.bridge?.build).toBe("test-build");
  });

  test("a bridge that answers busy after its hello marks the adapter busy", async () => {
    const fake = startFake();
    fake.hello = HELLO;
    fake.game = undefined;
    const { adapter } = makeAdapter(fake.port, "hold");
    await until(() => adapter.state.bridge !== null);
    fake.sendError(0, "busy");
    await until(() => adapter.state.problem === "busy");
    await until(() => fake.open === 0, "the close");
  });
});

describe("game messages", () => {
  test("a ROM change bumps the epoch and swaps the game", async () => {
    const { adapter, fake } = await live();
    expect(adapter.state.gameEpoch).toBe(1);
    fake.sendGame({ ...GBA_GAME, romName: "Ruby", crc32: "aaaaaaaa" });
    await until(() => adapter.state.gameEpoch === 2, "the second game message");
    expect(adapter.state.game?.crc32).toBe("aaaaaaaa");
    fake.sendGame(null);
    await until(() => adapter.state.gameEpoch === 3);
    expect(adapter.state.game).toBeNull();
    expect(await adapter.read([EWRAM], 250)).toEqual({
      kind: "failed",
      reason: "no_game",
    });
    expect(fake.reads).toHaveLength(0);
  });

  test("a game message drops the reply to a request sent before it", async () => {
    const { adapter, fake } = await live();
    let heldId: number | null = null;
    fake.onRead = (read) => {
      heldId = read.id;
    };
    const pending = adapter.read([EWRAM], 250);
    await until(() => heldId !== null, "the read");
    fake.sendGame({ ...GBA_GAME, crc32: "bbbbbbbb" });
    expect(await pending).toEqual({ kind: "failed", reason: "dropped" });
    // The late reply is discarded and frees the slot.
    fake.onRead = (read, socket) =>
      fake.reply(socket, read.id, fake.dataFor(read));
    fake.broadcast(FRAME_KIND.DATA, heldId ?? 0, new Uint8Array(4));
    fake.sendGame({ ...GBA_GAME, crc32: "cccccccc" });
    await until(() => adapter.state.game?.crc32 === "cccccccc");
    expect(sliceOf(await adapter.read([EWRAM], 250))).toHaveLength(1);
  });

  test("unknown domain names are dropped", async () => {
    const fake = startFake();
    fake.game = { ...GBA_GAME, domains: { rom: 100, ewram: 200, vram: 300 } };
    const { adapter } = makeAdapter(fake.port);
    await until(() => adapter.state.game !== null);
    expect(adapter.state.game?.domains).toEqual({ rom: 100, ewram: 200 });
  });

  test("a game body that fails validation is bridge_error, and the next valid one clears it", async () => {
    const { adapter, fake } = await live();
    fake.sendGame({ platform: "nds" });
    await until(() => adapter.state.problem === "bridge_error");
    expect(fake.open).toBe(1);
    expect(await adapter.read([EWRAM], 250)).toEqual({
      kind: "failed",
      reason: "disconnected",
    });
    fake.sendGame(GBA_GAME);
    await until(() => adapter.state.problem === null);
    expect(sliceOf(await adapter.read([EWRAM], 250))).toHaveLength(1);
  });
});

describe("reads", () => {
  test("out-of-range requests fail only their own slice and are not sent", async () => {
    const { adapter, fake } = await live();
    const slices = sliceOf(
      await adapter.read(
        [
          EWRAM,
          { domain: "iwram", offset: 32768 - 2, length: 4 },
          { domain: "sram", offset: 0, length: 1 },
        ],
        250,
      ),
    );
    expect(slices[0]).toEqual(expectedBytes("ewram", 0x100, 4));
    expect(slices[1]).toBeNull();
    expect(slices[2]).toBeNull();
    expect(fake.reads[0]?.ranges).toHaveLength(1);
  });

  test("a rom range over the caps is split, and RAM is read in the first request", async () => {
    const { adapter, fake } = await live();
    const slices = sliceOf(
      await adapter.read(
        [{ domain: "rom", offset: 1000, length: 150_000 }, EWRAM],
        250,
      ),
    );
    expect(fake.reads.length).toBe(3);
    const first = fake.reads[0];
    expect(first?.ranges[0]).toEqual({
      domain: "ewram",
      offset: 0x100,
      length: 4,
    });
    const total = fake.reads.reduce(
      (sum, r) => sum + r.ranges.reduce((s, x) => s + x.length, 0),
      0,
    );
    expect(total).toBe(150_004);
    for (const read of fake.reads) {
      expect(read.ranges.reduce((s, x) => s + x.length, 0)).toBeLessThanOrEqual(
        65536,
      );
    }
    expect(slices[0]).toEqual(expectedBytes("rom", 1000, 150_000));
    expect(slices[1]).toEqual(expectedBytes("ewram", 0x100, 4));
  });

  test("RAM ranges over the caps are never split and count as a timeout", async () => {
    const { adapter, fake } = await live();
    const outcome = await adapter.read(
      [
        { domain: "ewram", offset: 0, length: 40_000 },
        { domain: "ewram", offset: 40_000, length: 40_000 },
      ],
      250,
    );
    expect(outcome).toEqual({ kind: "timeout" });
    expect(fake.reads).toHaveLength(0);
  });

  test("an empty read gets empty data", async () => {
    const { adapter } = await live();
    expect(sliceOf(await adapter.read([], 250))).toEqual([]);
  });
});

describe("timeouts", () => {
  test("a silent bridge times out, sends nothing more, and a late reply frees the slot", async () => {
    const { adapter, fake, clock } = await live();
    let late: { id: number; body: Uint8Array } | null = null;
    fake.onRead = (read) => {
      late = { id: read.id, body: fake.dataFor(read) };
    };
    const first = adapter.read([EWRAM], 250);
    await until(() => late !== null, "the read");
    clock.advance(250);
    expect(await first).toEqual({ kind: "timeout" });

    // Ticks while the request is unanswered send nothing and count as timeouts (spec §4.5).
    expect(await adapter.read([EWRAM], 250)).toEqual({ kind: "timeout" });
    expect(await adapter.read([IWRAM], 250)).toEqual({ kind: "timeout" });
    expect(fake.reads).toHaveLength(1);

    // The late reply arrives, is discarded, and the next read goes out.
    const stale = late as unknown as { id: number; body: Uint8Array };
    fake.broadcast(FRAME_KIND.DATA, stale.id, stale.body);
    fake.sendGame(GBA_GAME);
    await until(() => adapter.state.gameEpoch === 2, "the marker game message");
    fake.onRead = (read, socket) =>
      fake.reply(socket, read.id, fake.dataFor(read));
    expect(sliceOf(await adapter.read([EWRAM], 250))).toEqual([
      expectedBytes("ewram", 0x100, 4),
    ]);
    expect(fake.reads).toHaveLength(2);
    expect(fake.reads[1]?.id).toBe(2);
  });

  test("a DATA reply of the wrong length is dropped and frees the slot", async () => {
    const { adapter, fake, lines } = await live();
    fake.onRead = (read, socket) =>
      fake.reply(socket, read.id, new Uint8Array(3));
    expect(await adapter.read([EWRAM], 250)).toEqual({
      kind: "failed",
      reason: "dropped",
    });
    expect(lines.some((l) => l.includes("wrong length"))).toBe(true);
    fake.onRead = (read, socket) =>
      fake.reply(socket, read.id, fake.dataFor(read));
    expect(sliceOf(await adapter.read([EWRAM], 250))).toHaveLength(1);
    expect(fake.open).toBe(1);
  });

  test("a reply with an id nobody asked for is logged and dropped", async () => {
    const { adapter, fake, lines } = await live();
    fake.broadcast(FRAME_KIND.DATA, 99, new Uint8Array(4));
    fake.sendError(99, "internal");
    fake.sendGame(GBA_GAME);
    await until(() => adapter.state.gameEpoch === 2);
    expect(lines.some((l) => l.includes("no pending request"))).toBe(true);
    expect(fake.open).toBe(1);
    expect(sliceOf(await adapter.read([EWRAM], 250))).toHaveLength(1);
  });
});

describe("error replies", () => {
  test("bad_range, too_large and unknown codes fail the cycle without data, and log once a minute", async () => {
    const { adapter, fake, clock, lines } = await live();
    fake.onRead = (read, socket) =>
      fake.error(socket, read.id, "bad_range", "oops");
    for (let i = 0; i < 3; i++) {
      expect(await adapter.read([EWRAM], 250)).toEqual({
        kind: "failed",
        reason: "bridge_error",
      });
    }
    expect(lines.filter((l) => l.includes("bad_range"))).toHaveLength(1);
    clock.advance(60_000);
    expect(await adapter.read([EWRAM], 250)).toEqual({
      kind: "failed",
      reason: "bridge_error",
    });
    expect(lines.filter((l) => l.includes("bad_range"))).toHaveLength(2);
    // An unknown code counts as internal.
    fake.onRead = (read, socket) => fake.error(socket, read.id, "mystery");
    expect(await adapter.read([EWRAM], 250)).toEqual({
      kind: "failed",
      reason: "bridge_error",
    });
    expect(lines.some((l) => l.includes("internal"))).toBe(true);
    expect(adapter.state.problem).toBeNull();
    expect(fake.open).toBe(1);
  });

  test("no_game acts like a null game message", async () => {
    const { adapter, fake } = await live();
    fake.onRead = (read, socket) => fake.error(socket, read.id, "no_game");
    expect(await adapter.read([EWRAM], 250)).toEqual({
      kind: "failed",
      reason: "no_game",
    });
    expect(adapter.state.game).toBeNull();
    expect(adapter.state.gameEpoch).toBe(2);
  });

  test("an ERROR body that fails validation counts as internal", async () => {
    const { adapter, fake } = await live();
    fake.onRead = (read, socket) =>
      socket.write(
        encodeFrame(FRAME_KIND.ERROR, read.id, new TextEncoder().encode("[1]")),
      );
    expect(await adapter.read([EWRAM], 250)).toEqual({
      kind: "failed",
      reason: "bridge_error",
    });
    expect(fake.open).toBe(1);
  });
});

describe("close and reconnect", () => {
  test("a close mid-request fails the read, then the adapter reconnects with backoff", async () => {
    const { adapter, fake, clock } = await live();
    fake.onRead = () => {
      fake.dropClients();
    };
    expect(await adapter.read([EWRAM], 250)).toEqual({
      kind: "failed",
      reason: "disconnected",
    });
    expect(adapter.state.connection).toBe("disconnected");
    expect(adapter.state.game).toBeNull();
    const epoch = adapter.state.gameEpoch;
    fake.onRead = (read, socket) =>
      fake.reply(socket, read.id, fake.dataFor(read));
    await sleep(20);
    expect(fake.connections).toBe(1);
    clock.advance(499);
    await sleep(20);
    expect(fake.connections).toBe(1);
    clock.advance(1);
    await until(() => adapter.state.game !== null, "the reconnect");
    expect(fake.connections).toBe(2);
    expect(adapter.state.gameEpoch).toBeGreaterThan(epoch);
    // Request ids start again at 1 on the new connection.
    expect(sliceOf(await adapter.read([EWRAM], 250))).toHaveLength(1);
    expect(fake.reads.at(-1)?.id).toBe(1);
  });

  test("a refused connect is not a problem, and the adapter keeps retrying until a bridge appears", async () => {
    const probe = startFake();
    const port = probe.port;
    probe.stop();
    const { adapter, clock } = makeAdapter(port);
    await until(() => adapter.state.connection === "disconnected");
    expect(adapter.state.problem).toBeNull();
    expect(adapter.state.bridge).toBeNull();
    const fake = new FakeBridge();
    fakes.push(fake);
    fake.start(port);
    for (let i = 0; i < 20 && adapter.state.game === null; i++) {
      clock.advance(5000);
      await sleep(20);
    }
    expect(adapter.state.game).not.toBeNull();
    expect(adapter.state.problem).toBeNull();
  });

  test("garbage after a valid hello is bridge_error and a reconnect", async () => {
    const { adapter, fake, clock } = await live();
    fake.sendRaw(new Uint8Array([0, 0, 0, 5, 99, 0, 0, 0, 0]));
    await until(() => fake.open === 0, "the close");
    expect(adapter.state.problem).toBe("bridge_error");
    clock.advance(500);
    await until(() => adapter.state.problem === null, "the clean reconnect");
    expect(adapter.state.game).not.toBeNull();
  });

  test("close() ends the connection and stops retrying", async () => {
    const { adapter, fake, clock } = await live();
    await adapter.close();
    await until(() => fake.open === 0);
    clock.advance(60_000);
    await sleep(30);
    expect(fake.connections).toBe(1);
  });
});
