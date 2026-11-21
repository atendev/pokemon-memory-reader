import { afterEach, describe, expect, test } from "bun:test";
import { createRetroArchAdapter } from "../../src/adapter/retroarch/adapter";
import type {
  AdapterMode,
  AdapterState,
  ManagedAdapter,
  Range,
} from "../../src/adapter/types";
import type { Log } from "../../src/log";
import { ManualClock } from "../bridge/manual-clock";
import { emeraldMemory, TREECKO } from "../support/emerald-memory";
import {
  EMERALD_STATUS,
  FakeRetroArch,
  gbaDescriptors,
} from "./fake-retroarch";

const fakes: FakeRetroArch[] = [];
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

const settle = () => new Promise((r) => setTimeout(r, 15));

async function startFake(): Promise<FakeRetroArch> {
  const fake = new FakeRetroArch();
  fake.descriptors = gbaDescriptors(emeraldMemory([TREECKO]));
  await fake.start();
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

function makeAdapter(port: number, mode: AdapterMode = "live") {
  const clock = new ManualClock();
  const { log, lines } = makeLog();
  const adapter = createRetroArchAdapter(
    { host: "127.0.0.1", port },
    { clock, log },
  );
  adapters.push(adapter);
  const states: AdapterState[] = [];
  adapter.subscribe((s) => states.push(s));
  adapter.setMode(mode);
  return { adapter, clock, lines, states };
}

/** Advances the manual clock in steps and lets replies land between them. */
async function advance(clock: ManualClock, ms: number, step = 250) {
  for (let left = ms; left > 0; left -= step) {
    clock.advance(Math.min(step, left));
    await new Promise((r) => setTimeout(r, 1));
  }
}

describe("probe", () => {
  test("one valid GET_STATUS reply makes it usable with the game from the reply", async () => {
    const fake = await startFake();
    const { adapter } = makeAdapter(fake.port);
    await until(() => adapter.state.connection === "connected");
    expect(adapter.state.problem).toBeNull();
    expect(adapter.state.bridge).toBeNull();
    expect(adapter.state.game).toMatchObject({
      platform: "gba",
      contentName: "Pokemon - Emerald Version",
      crc32: null,
    });
    expect(fake.seen[0]).toBe("GET_STATUS");
    // The probe adds no RAM test read (amendment 026, point 3).
    expect(fake.reads).toHaveLength(0);
  });

  test("waits 1 s, then stays disconnected with no problem and probes again on the backoff", async () => {
    const fake = await startFake();
    fake.silent = true;
    const { adapter, clock } = makeAdapter(fake.port, "probe");
    await until(() => fake.statuses.length === 1, "the first probe");
    clock.advance(999);
    await settle();
    expect(fake.statuses).toHaveLength(1);
    clock.advance(1);
    // The probe failed and the backoff (500 ms) starts.
    expect(adapter.state.connection).toBe("disconnected");
    expect(adapter.state.problem).toBeNull();
    clock.advance(500);
    await until(() => fake.statuses.length === 2, "the second probe");
  });

  test("RetroArch that starts answering later becomes usable at its first valid reply", async () => {
    const fake = await startFake();
    fake.silent = true;
    const { adapter, clock } = makeAdapter(fake.port);
    await advance(clock, 3000, 100);
    expect(adapter.state.connection).toBe("disconnected");
    fake.silent = false;
    await advance(clock, 5000, 100);
    await until(() => adapter.state.connection === "connected", "usable");
    expect(adapter.state.problem).toBeNull();
  });

  test("an ICMP port-unreachable ends the probe at once", async () => {
    const fake = await startFake();
    const port = fake.port;
    fake.stop();
    fakes.pop();
    const { adapter, clock } = makeAdapter(port, "probe");
    await settle();
    await settle();
    expect(adapter.state.connection).toBe("disconnected");
    expect(adapter.state.problem).toBeNull();
    // Re-probing waits only on the backoff, not on the 1 s timeout.
    clock.advance(500);
    await settle();
    expect(adapter.state.connection).toBe("disconnected");
  });

  test("a probe-mode adapter reports connected to listeners, then closes the probe", async () => {
    const fake = await startFake();
    const { adapter, states } = makeAdapter(fake.port, "probe");
    await until(() => states.some((s) => s.connection === "connected"));
    expect(adapter.state.connection).toBe("disconnected");
    expect(adapter.state.game).toBeNull();
  });

  test("a reply that starts with GET_STATUS but doesn't parse counts as no reply, and is logged once", async () => {
    const fake = await startFake();
    fake.status = "GET_STATUS NONSENSE";
    const { adapter, clock, lines } = makeAdapter(fake.port, "probe");
    await until(() => fake.statuses.length === 1);
    await settle();
    clock.advance(1000);
    clock.advance(500);
    await until(() => fake.statuses.length === 2);
    await settle();
    expect(adapter.state.connection).toBe("disconnected");
    expect(lines.filter((l) => l.includes("can't read"))).toHaveLength(1);
  });

  test("GET_STATUS ERROR is not a valid probe reply", async () => {
    const fake = await startFake();
    fake.status = "GET_STATUS ERROR";
    const { adapter, clock } = makeAdapter(fake.port, "probe");
    await until(() => fake.statuses.length === 1);
    await settle();
    clock.advance(1000);
    expect(adapter.state.connection).toBe("disconnected");
    expect(adapter.state.game).toBeNull();
  });

  test("a probe-mode adapter that keeps finding RetroArch backs off between probes", async () => {
    const fake = await startFake();
    const { clock } = makeAdapter(fake.port, "probe");
    await until(() => fake.statuses.length === 1);
    await settle();
    clock.advance(500);
    await until(() => fake.statuses.length === 2);
    await settle();
    // The second wait is 1000 ms, not 500 ms.
    clock.advance(500);
    await settle();
    expect(fake.statuses).toHaveLength(2);
    clock.advance(500);
    await until(() => fake.statuses.length === 3);
  });

  test("CONTENTLESS and an unread system are usable with no game", async () => {
    const fake = await startFake();
    fake.status = "GET_STATUS CONTENTLESS";
    const { adapter } = makeAdapter(fake.port);
    await until(() => adapter.state.connection === "connected");
    expect(adapter.state.game).toBeNull();
    const other = await startFake();
    other.status = "GET_STATUS PLAYING nes,Mario";
    const second = makeAdapter(other.port);
    await until(() => second.adapter.state.connection === "connected");
    expect(second.adapter.state.game).toBeNull();
  });
});

describe("reads", () => {
  test("a range is cut at 16 KiB, sent as one datagram per chunk, and reassembled", async () => {
    const fake = await startFake();
    const memory = emeraldMemory([TREECKO]);
    for (let i = 0; i < memory.ewram.length; i++)
      memory.ewram[i] = (i * 7) & 0xff;
    fake.descriptors = gbaDescriptors(memory);
    const { adapter } = makeAdapter(fake.port);
    await until(() => adapter.state.game !== null);
    const range: Range = { domain: "ewram", offset: 0x100, length: 40000 };
    const outcome = await adapter.read([range], 250);
    expect(fake.reads.map((c) => c.split(" ")[2])).toEqual([
      "16384",
      "16384",
      "7232",
    ]);
    expect(outcome.kind).toBe("data");
    if (outcome.kind !== "data") return;
    expect(outcome.slices[0]).toEqual(
      memory.ewram.subarray(0x100, 0x100 + 40000),
    );
  });

  test("an out-of-bounds range comes back null and the others still read", async () => {
    const fake = await startFake();
    const { adapter } = makeAdapter(fake.port);
    await until(() => adapter.state.game !== null);
    const outcome = await adapter.read(
      [
        { domain: "ewram", offset: 0x3ffff, length: 8 },
        { domain: "iwram", offset: 0, length: 4 },
      ],
      250,
    );
    expect(outcome.kind).toBe("data");
    if (outcome.kind !== "data") return;
    expect(outcome.slices[0]).toBeNull();
    expect(outcome.slices[1]).toEqual(new Uint8Array(4));
  });

  test("a short reply or an error reply fails only its own range", async () => {
    const fake = await startFake();
    const memory = emeraldMemory([TREECKO]);
    fake.descriptors = [
      { start: 0x02000000, bytes: memory.ewram.subarray(0, 0x20) },
      { start: 0x03000000, bytes: memory.iwram },
    ];
    const { adapter, lines } = makeAdapter(fake.port);
    await until(() => adapter.state.game !== null);
    const outcome = await adapter.read(
      [
        { domain: "ewram", offset: 0x10, length: 0x40 },
        { domain: "iwram", offset: 0, length: 8 },
        { domain: "rom", offset: 0, length: 4 },
      ],
      250,
    );
    expect(outcome.kind).toBe("data");
    if (outcome.kind !== "data") return;
    expect(outcome.slices[0]).toBeNull();
    expect(outcome.slices[1]).toEqual(new Uint8Array(8));
    expect(outcome.slices[2]).toBeNull();
    expect(lines.some((l) => l.includes("fewer bytes"))).toBe(true);
  });

  test("a batch with one lost datagram is a timeout, with no partial data", async () => {
    const fake = await startFake();
    const { adapter, clock } = makeAdapter(fake.port);
    await until(() => adapter.state.game !== null);
    fake.drop = (command) => command.startsWith("READ_CORE_MEMORY 3000000");
    const pending = adapter.read(
      [
        { domain: "ewram", offset: 0, length: 4 },
        { domain: "iwram", offset: 0, length: 4 },
      ],
      250,
    );
    await until(() => fake.reads.length === 2);
    await settle();
    clock.advance(250);
    expect(await pending).toEqual({ kind: "timeout" });
  });

  test("a late reply for a chunk the next batch also asks for is accepted", async () => {
    const fake = await startFake();
    const { adapter, clock } = makeAdapter(fake.port);
    await until(() => adapter.state.game !== null);
    const range: Range = { domain: "iwram", offset: 0, length: 4 };
    fake.drop = () => true;
    const first = adapter.read([range], 250);
    await until(() => fake.reads.length === 1);
    clock.advance(250);
    expect((await first).kind).toBe("timeout");
    fake.drop = () => false;
    const second = adapter.read([range], 250);
    await until(() => fake.reads.length === 2);
    expect((await second).kind).toBe("data");
  });

  test("replies that match no chunk of the batch are discarded", async () => {
    const fake = await startFake();
    const { adapter } = makeAdapter(fake.port);
    await until(() => adapter.state.game !== null);
    fake.drop = () => true;
    const pending = adapter.read(
      [{ domain: "iwram", offset: 0, length: 4 }],
      250,
    );
    await until(() => fake.reads.length === 1);
    // Wrong address, and right address with too many bytes: neither settles the chunk.
    fake.push("READ_CORE_MEMORY 3000100 00 00 00 00");
    fake.push("READ_CORE_MEMORY 3000000 00 00 00 00 00");
    await settle();
    let done = false;
    void pending.then(() => {
      done = true;
    });
    await settle();
    expect(done).toBe(false);
    fake.push("READ_CORE_MEMORY 3000000 01 02 03 04");
    const outcome = await pending;
    expect(outcome.kind === "data" && outcome.slices[0]).toEqual(
      Uint8Array.of(1, 2, 3, 4),
    );
  });

  test("reads fail while not live and while there is no game", async () => {
    const fake = await startFake();
    const probing = makeAdapter(fake.port, "probe");
    expect(await probing.adapter.read([], 250)).toEqual({
      kind: "failed",
      reason: "disconnected",
    });
    fake.status = "GET_STATUS CONTENTLESS";
    const { adapter } = makeAdapter(fake.port);
    await until(() => adapter.state.connection === "connected");
    expect(await adapter.read([], 250)).toEqual({
      kind: "failed",
      reason: "no_game",
    });
  });

  test("a second read while one is pending rejects", async () => {
    const fake = await startFake();
    const { adapter } = makeAdapter(fake.port);
    await until(() => adapter.state.game !== null);
    fake.silent = true;
    const range: Range = { domain: "iwram", offset: 0, length: 4 };
    const first = adapter.read([range], 250);
    expect(adapter.read([range], 250)).rejects.toThrow("one read at a time");
    await adapter.close();
    await first;
  });

  test("GET_STATUS rides along with a batch at most once a second", async () => {
    const fake = await startFake();
    const { adapter, clock } = makeAdapter(fake.port);
    await until(() => adapter.state.game !== null);
    const before = fake.statuses.length;
    const range: Range = { domain: "iwram", offset: 0, length: 4 };
    await adapter.read([range], 250);
    await adapter.read([range], 250);
    expect(fake.statuses.length - before).toBe(1);
    clock.advance(1000);
    await adapter.read([range], 250);
    expect(fake.statuses.length - before).toBe(2);
  });
});

describe("disconnect", () => {
  test("a closed adapter fails reads as disconnected", async () => {
    const fake = await startFake();
    const { adapter } = makeAdapter(fake.port);
    await until(() => adapter.state.game !== null);
    await adapter.close();
    expect(
      await adapter.read([{ domain: "iwram", offset: 0, length: 4 }], 250),
    ).toEqual({
      kind: "failed",
      reason: "disconnected",
    });
  });

  test("30 s with no reply disconnects, and not a moment sooner", async () => {
    const fake = await startFake();
    const { adapter, clock } = makeAdapter(fake.port);
    await until(() => adapter.state.connection === "connected");
    fake.silent = true;
    await advance(clock, 29_000);
    expect(adapter.state.connection).toBe("connected");
    await advance(clock, 1000, 100);
    expect(adapter.state.connection).toBe("disconnected");
    expect(adapter.state.game).toBeNull();
    expect(adapter.state.problem).toBeNull();
  });

  test("replies keep it connected past 30 s", async () => {
    const fake = await startFake();
    const { adapter, clock } = makeAdapter(fake.port);
    await until(() => adapter.state.connection === "connected");
    await advance(clock, 40_000, 500);
    expect(adapter.state.connection).toBe("connected");
  });

  test("a pending read finishes as disconnected, and RetroArch coming back reconnects", async () => {
    const fake = await startFake();
    const { adapter, clock } = makeAdapter(fake.port);
    await until(() => adapter.state.connection === "connected");
    fake.silent = true;
    const pending = adapter.read(
      [{ domain: "iwram", offset: 0, length: 4 }],
      60_000,
    );
    await advance(clock, 30_000, 500);
    expect(await pending).toEqual({ kind: "failed", reason: "disconnected" });
    fake.silent = false;
    await advance(clock, 6000, 250);
    await until(() => adapter.state.connection === "connected");
    expect(adapter.state.game).not.toBeNull();
  });
});

describe("the 2 s check", () => {
  test("a changed content name starts a new game", async () => {
    const fake = await startFake();
    const { adapter, clock } = makeAdapter(fake.port);
    await until(() => adapter.state.game !== null);
    const epoch = adapter.state.gameEpoch;
    await advance(clock, 2000);
    await until(() => fake.reads.length >= 1, "the header read");
    expect(fake.reads[0]).toBe("READ_CORE_MEMORY 80000a0 29");
    await advance(clock, 2000);
    await settle();
    expect(adapter.state.gameEpoch).toBe(epoch);
    fake.status = "GET_STATUS PLAYING gba,Emerald Rando";
    await advance(clock, 2000);
    await until(() => adapter.state.gameEpoch === epoch + 1, "the new game");
    expect(adapter.state.game?.contentName).toBe("Emerald Rando");
  });

  test("PLAYING and PAUSED are the same content", async () => {
    const fake = await startFake();
    const { adapter, clock } = makeAdapter(fake.port);
    await until(() => adapter.state.game !== null);
    const epoch = adapter.state.gameEpoch;
    await advance(clock, 2000);
    await settle();
    fake.status = EMERALD_STATUS.replace("PLAYING", "PAUSED");
    await advance(clock, 4000);
    await settle();
    expect(adapter.state.gameEpoch).toBe(epoch);
  });

  test("a new crc32 or new header bytes start a new game", async () => {
    const fake = await startFake();
    const { adapter, clock } = makeAdapter(fake.port);
    await until(() => adapter.state.game !== null);
    const epoch = adapter.state.gameEpoch;
    await advance(clock, 2000);
    await settle();
    fake.status = `${EMERALD_STATUS},crc32=1a2b3c4d`;
    await advance(clock, 2000);
    await until(() => adapter.state.gameEpoch === epoch + 1, "the crc change");
    // The user swaps the core: the header read turns into an unmapped-address error.
    fake.descriptors = [{ start: 0x02000000, bytes: new Uint8Array(0x40000) }];
    await advance(clock, 2000);
    await until(
      () => adapter.state.gameEpoch === epoch + 2,
      "the header change",
    );
  });

  test("CONTENTLESS ends the game, and new content starts one", async () => {
    const fake = await startFake();
    const { adapter, clock } = makeAdapter(fake.port);
    await until(() => adapter.state.game !== null);
    fake.status = "GET_STATUS CONTENTLESS";
    await advance(clock, 2000);
    await until(() => adapter.state.game === null, "no_game");
    fake.status = EMERALD_STATUS;
    await advance(clock, 2000);
    await until(() => adapter.state.game !== null, "the game back");
  });

  test("a timed-out check changes nothing", async () => {
    const fake = await startFake();
    const { adapter, clock } = makeAdapter(fake.port);
    await until(() => adapter.state.game !== null);
    const epoch = adapter.state.gameEpoch;
    await advance(clock, 2000);
    await settle();
    fake.status = "GET_STATUS PLAYING gba,Other game";
    fake.drop = () => true;
    await advance(clock, 6000);
    expect(adapter.state.gameEpoch).toBe(epoch);
    expect(adapter.state.connection).toBe("connected");
  });
});
