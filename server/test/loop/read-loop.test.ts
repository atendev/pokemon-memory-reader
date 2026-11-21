import { afterEach, describe, expect, test } from "bun:test";
import type {
  Adapter,
  AdapterState,
  Range,
  ReadOutcome,
} from "../../src/adapter/types";
import type { BoundGame } from "../../src/format/registry";
import { ok } from "../../src/format/types";
import { silentLog } from "../../src/log";
import { createReadLoop, normalizePollHz } from "../../src/loop/read-loop";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import { ManualClock } from "../bridge/manual-clock";
import { emeraldMemory, serve, TREECKO } from "../support/emerald-memory";

const { registry } = loadProfiles({ builtin: [emerald], user: [] });

const GAME = {
  platform: "gba",
  crc32: "1a2b3c4d",
  sha1: null,
  romName: "Emerald",
  domains: { rom: 0x400, ewram: 0x40000, iwram: 0x8000 },
} as const;

const CONNECTED: AdapterState = {
  connection: "connected",
  bridge: null,
  problem: null,
  game: GAME,
  gameEpoch: 1,
};

/** An in-memory adapter. Each read is answered by `answer`, which a test can hold open. */
class MemoryAdapter implements Adapter {
  readonly id = "mgba";
  readonly limits = { minIntervalMs: 0, mergeGap: 32 };
  state: AdapterState = CONNECTED;
  memory = emeraldMemory([TREECKO]);
  reads: Range[][] = [];
  inFlight = 0;
  maxInFlight = 0;
  gate: Promise<void> | null = null;
  #listeners = new Set<(state: AdapterState) => void>();

  subscribe(listener: (state: AdapterState) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  set(state: AdapterState): void {
    this.state = state;
    for (const listener of this.#listeners) listener(state);
  }

  async read(ranges: readonly Range[]): Promise<ReadOutcome> {
    this.reads.push([...ranges]);
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    await this.gate;
    this.inFlight--;
    return {
      kind: "data",
      slices: ranges.map((range) => serve(this.memory, [range])),
    };
  }

  /** Reads that asked for party bytes, as opposed to the header. */
  get partyReads(): number {
    return this.reads.filter((r) => r.some((x) => x.domain === "ewram")).length;
  }
}

const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};

const open: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const loop of open.splice(0)) await loop.close();
});

function setup(pollHz = 20, bind?: (profile: unknown) => BoundGame) {
  const adapter = new MemoryAdapter();
  const clock = new ManualClock();
  const loop = createReadLoop({
    adapter,
    registry,
    pollHz,
    clock,
    log: silentLog,
    ...(bind && { bind }),
  });
  open.push(loop);
  return { adapter, clock, loop };
}

describe("read loop", () => {
  test("identifies from the header and reads nothing else without demand", async () => {
    const { adapter, clock, loop } = setup();
    await flush();
    expect(loop.status().state).toBe("game");
    for (let i = 0; i < 10; i++) {
      clock.advance(50);
      await flush();
    }
    expect(adapter.partyReads).toBe(0);
    expect(adapter.reads).toHaveLength(1);
  });

  test("a cold GET runs one extra read shared by concurrent callers", async () => {
    const { adapter, loop } = setup();
    await flush();
    const [a, b] = await Promise.all([loop.get("party"), loop.get("party")]);
    expect(a.ok && b.ok).toBe(true);
    expect(adapter.partyReads).toBe(1);
  });

  test("a warm GET returns the cached value with no read", async () => {
    const { adapter, loop } = setup();
    await flush();
    await loop.get("party");
    const before = adapter.partyReads;
    const again = await loop.get("party");
    expect(again.ok).toBe(true);
    expect(adapter.partyReads).toBe(before);
  });

  test("a demanded party is read on every tick, then stops once demand lapses", async () => {
    const { adapter, clock, loop } = setup(20);
    await flush();
    await loop.get("party");
    const after = adapter.partyReads;
    for (let i = 0; i < 4; i++) {
      clock.advance(50);
      await flush();
    }
    expect(adapter.partyReads).toBeGreaterThanOrEqual(after + 3);

    clock.advance(5100);
    await flush();
    const lapsed = adapter.partyReads;
    for (let i = 0; i < 4; i++) {
      clock.advance(50);
      await flush();
    }
    expect(adapter.partyReads).toBeLessThanOrEqual(lapsed + 1);
  });

  test("reads never overlap even when one is slow", async () => {
    const { adapter, clock, loop } = setup();
    await flush();
    await loop.get("party");
    let release = () => {};
    adapter.gate = new Promise<void>((r) => {
      release = r;
    });
    for (let i = 0; i < 6; i++) {
      clock.advance(50);
      await flush();
    }
    release();
    adapter.gate = null;
    await flush();
    expect(adapter.maxInFlight).toBe(1);
  });

  test("a game change drops the old values and re-identifies", async () => {
    const { adapter, loop } = setup();
    await flush();
    await loop.get("party");
    adapter.set({ ...CONNECTED, game: null, gameEpoch: 2 });
    expect(loop.status().state).toBe("no_game");
    const refused = await loop.get("party");
    expect(refused).toMatchObject({ ok: false, code: "no_game" });

    adapter.memory = emeraldMemory([]);
    adapter.set({ ...CONNECTED, gameEpoch: 3 });
    await flush();
    expect(loop.status().state).toBe("game");
    const fresh = await loop.get("party");
    expect(fresh.ok && fresh.value.pokemon).toEqual([]);
  });

  test("a disconnected adapter refuses with disconnected", async () => {
    const { adapter, loop } = setup();
    await flush();
    adapter.set({ ...CONNECTED, connection: "disconnected", game: null });
    expect(await loop.get("party")).toMatchObject({
      ok: false,
      code: "disconnected",
    });
  });

  test("a decode failure keeps the last good value while warm, and gives no_data on a cold GET", async () => {
    const { adapter, clock, loop } = setup(20);
    await flush();
    const first = await loop.get("party");
    expect(first.ok).toBe(true);
    const checksumAt = 0x244ec + 0x1c;
    // Flip the first mon's checksum byte.
    adapter.memory.ewram.set(
      [~(adapter.memory.ewram[checksumAt] ?? 0) & 0xff],
      checksumAt,
    );
    const readsBefore = adapter.partyReads;
    for (let i = 0; i < 3; i++) {
      clock.advance(50);
      await flush();
    }
    // The corrupted bytes were read and failed to decode, and the old value still stands.
    expect(adapter.partyReads).toBeGreaterThan(readsBefore);
    const warm = await loop.get("party");
    expect(warm.ok).toBe(true);

    clock.advance(5100);
    await flush();
    expect(await loop.get("party")).toMatchObject({
      ok: false,
      code: "no_data",
    });
  });
});

/** A party that lives behind the pointer word at IWRAM 0x100: its decoded size is the byte the pointer leads to. */
const POINTER_WORD = 0x100;
const gamePointing: BoundGame = {
  party: {
    regions: {
      body: {
        kind: "pointer",
        at: {
          at: { domain: "iwram", offset: POINTER_WORD },
          width: 4,
          bank: null,
          offset: 0,
        },
        length: 1,
      },
    },
    decode: (slices) =>
      ok({ pokemon: new Array(slices.body?.u8(0)).fill({}) } as never),
  },
};

describe("pointer-derived regions in the loop", () => {
  const point = (adapter: MemoryAdapter, target: number, size: number) => {
    adapter.memory.ewram[target] = size;
    new DataView(adapter.memory.iwram.buffer).setUint32(
      POINTER_WORD,
      0x02000000 + target,
      true,
    );
  };
  const size = async (loop: ReturnType<typeof setup>["loop"]) => {
    const got = await loop.get("party");
    return got.ok ? got.value.pokemon.length : got.code;
  };

  test("attach sends the pointer words, then the regions, and steady state sends one request", async () => {
    const { adapter, clock, loop } = setup(20, () => gamePointing);
    point(adapter, 0x2000, 3);
    await flush();
    const afterIdentify = adapter.reads.length;

    expect(await size(loop)).toBe(3);
    expect(adapter.reads.slice(afterIdentify)).toEqual([
      [{ domain: "iwram", offset: POINTER_WORD, length: 4 }],
      [
        { domain: "iwram", offset: POINTER_WORD, length: 4 },
        { domain: "ewram", offset: 0x2000, length: 1 },
      ],
    ]);

    const steady = adapter.reads.length;
    for (let i = 0; i < 3; i++) {
      clock.advance(50);
      await flush();
    }
    expect(adapter.reads.length).toBeGreaterThan(steady);
    for (const request of adapter.reads.slice(steady)) {
      expect(request).toHaveLength(2);
    }
  });

  test("a moved pointer drops that cycle's result and the next cycle reads the new address", async () => {
    const { adapter, clock, loop } = setup(20, () => gamePointing);
    point(adapter, 0x2000, 3);
    await flush();
    expect(await size(loop)).toBe(3);

    adapter.memory.ewram[0x3000] = 5;
    point(adapter, 0x3000, 5);
    clock.advance(50);
    await flush();
    // The tick that saw the move read the old address under the new pointer, so it kept the old value.
    expect(await size(loop)).toBe(3);
    clock.advance(50);
    await flush();
    expect(await size(loop)).toBe(5);
  });

  test("a null pointer fails only the decoders that use it, and the next valid pointer recovers", async () => {
    const { adapter, clock, loop } = setup(20, () => gamePointing);
    point(adapter, 0x2000, 3);
    await flush();
    expect(await size(loop)).toBe(3);

    adapter.memory.iwram.fill(0, POINTER_WORD, POINTER_WORD + 4);
    clock.advance(5100);
    await flush();
    expect(await size(loop)).toBe("no_data");
    expect(loop.status().state).toBe("game");

    point(adapter, 0x4000, 7);
    clock.advance(50);
    await flush();
    clock.advance(50);
    await flush();
    expect(await size(loop)).toBe(7);
  });

  test("a game change forgets the pointers, so the next cycle sends two requests again", async () => {
    const { adapter, loop } = setup(20, () => gamePointing);
    point(adapter, 0x2000, 3);
    await flush();
    await size(loop);

    adapter.set({ ...CONNECTED, gameEpoch: 2 });
    await flush();
    const before = adapter.reads.length;
    expect(await size(loop)).toBe(3);
    expect(adapter.reads.length - before).toBe(2);
  });
});

describe("normalizePollHz", () => {
  const warnings: string[] = [];
  const log = { ...silentLog, warn: (m: string) => warnings.push(m) };

  test("clamps to 5-60 and falls back to 20", () => {
    expect(normalizePollHz(30, log)).toBe(30);
    expect(normalizePollHz(1, log)).toBe(5);
    expect(normalizePollHz(500, log)).toBe(60);
    expect(normalizePollHz(2.5, log)).toBe(20);
    expect(normalizePollHz("x", log)).toBe(20);
    expect(warnings).toHaveLength(4);
  });
});
