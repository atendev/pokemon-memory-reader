import { afterEach, describe, expect, test } from "bun:test";
import { Box, Boxes, ErrorBody } from "@pokemon-memory-reader/api/schemas";
import type {
  Adapter,
  AdapterState,
  Range,
  ReadOutcome,
} from "../../src/adapter/types";
import { createApp } from "../../src/app/app";
import { STORAGE } from "../../src/format/gen3/structs";
import type { Log } from "../../src/log";
import { createReadLoop } from "../../src/loop/read-loop";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import { ManualClock } from "../bridge/manual-clock";
import { encodeMon, type MonSpec, storageBytes } from "../gen3/encode";
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

/** gPokemonStorage is a pointer word at IWRAM 0x5d94 (0x03005d94). */
const POINTER_WORD = 0x5d94;
const STORAGE_AT = 0x20000;
const OTHER_STORAGE_AT = 0x30000;
const BOX_TIMEOUT = 1000;

const mon = (species: number, nickname: string): MonSpec => ({
  ...TREECKO,
  species,
  nickname,
});

class BoxAdapter implements Adapter {
  readonly id = "mgba";
  readonly limits = { minIntervalMs: 0, mergeGap: 32 };
  state: AdapterState = CONNECTED;
  memory = emeraldMemory([TREECKO]);
  reads: { ranges: Range[]; timeoutMs: number }[] = [];
  /** What a box request (the one with the 1000 ms timeout) gets back instead of data, when set. */
  boxOutcome: "data" | "timeout" | "hang" = "data";
  #hung: (() => void)[] = [];
  #listeners = new Set<(state: AdapterState) => void>();

  subscribe(listener: (state: AdapterState) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  set(state: AdapterState): void {
    this.state = state;
    for (const listener of this.#listeners) listener(state);
  }

  async read(
    ranges: readonly Range[],
    timeoutMs: number,
  ): Promise<ReadOutcome> {
    this.reads.push({ ranges: [...ranges], timeoutMs });
    if (timeoutMs === BOX_TIMEOUT && this.boxOutcome === "timeout")
      return { kind: "timeout" };
    if (timeoutMs === BOX_TIMEOUT && this.boxOutcome === "hang")
      await new Promise<void>((resolve) => this.#hung.push(resolve));
    return {
      kind: "data",
      slices: ranges.map((range) => serve(this.memory, [range])),
    };
  }

  /** Lets every hung box request answer. */
  release(): void {
    this.boxOutcome = "data";
    for (const resolve of this.#hung.splice(0)) resolve();
  }

  /** Writes a storage block at `at` and points the pointer word at it. */
  putStorage(at: number, bytes: Uint8Array, point = true): void {
    this.memory.ewram.set(bytes, at);
    if (point) this.point(at);
  }

  point(at: number | null): void {
    new DataView(this.memory.iwram.buffer).setUint32(
      POINTER_WORD,
      at === null ? 0 : 0x02000000 + at,
      true,
    );
  }

  get boxRequests(): Range[][] {
    return this.reads
      .filter((read) => read.timeoutMs === BOX_TIMEOUT)
      .map((read) => read.ranges);
  }

  /** The main batch reads that asked for party bytes (gPlayerParty at EWRAM 0x244ec). */
  get mainReads(): number {
    return this.reads.filter(
      (read) =>
        read.timeoutMs !== BOX_TIMEOUT &&
        read.ranges.some((x) => x.domain === "ewram" && x.offset === 0x244ec),
    ).length;
  }
}

const flush = async () => {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
};

const open: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const loop of open.splice(0)) await loop.close();
});

function setup(log?: Log) {
  const adapter = new BoxAdapter();
  adapter.putStorage(
    STORAGE_AT,
    storageBytes({
      currentBox: 2,
      slots: { 0: { 0: encodeMon(mon(277, "ZERO")) } },
    }),
  );
  const clock = new ManualClock();
  const loop = createReadLoop({
    adapter,
    registry,
    pollHz: 20,
    clock,
    log: log ?? silentLog(),
  });
  open.push(loop);
  const app = createApp({ resources: loop });
  /** Advances time one tick at a time. A longer `step` skips ticks, for waits where only the clock matters. */
  const tick = async (ms: number, step = 50) => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      await flush();
    }
  };
  return { adapter, clock, loop, app, tick };
}

function silentLog(): Log {
  return { debug() {}, info() {}, warn() {}, error() {} };
}

const get = (app: ReturnType<typeof setup>["app"], path: string) =>
  app.request(`/api/v2${path}`);

describe("the boxes routes", () => {
  test("GET /boxes serves the whole resource and it parses with the real schema", async () => {
    const { app } = setup();
    await flush();
    const response = await get(app, "/boxes");
    expect(response.status).toBe(200);
    const boxes = Boxes.parse(await response.json());
    expect(boxes.currentBox).toBe(2);
    expect(boxes.boxes).toHaveLength(STORAGE.boxCount);
    expect(boxes.boxes[0]?.slots[0]?.nickname).toBe("ZERO");
    expect(boxes.boxes[0]?.slots[1]).toBeNull();
  });

  test("GET /boxes/:n serves one box", async () => {
    const { app } = setup();
    await flush();
    const response = await get(app, "/boxes/0");
    expect(response.status).toBe(200);
    const box = Box.parse(await response.json());
    expect(box.index).toBe(0);
    expect(box.slots[0]?.nickname).toBe("ZERO");
    const last = Box.parse(
      await (await get(app, `/boxes/${STORAGE.boxCount - 1}`)).json(),
    );
    expect(last.index).toBe(STORAGE.boxCount - 1);
  });

  test.each(["14", "99", "-1", "1.5", "abc", "01", "1e1", "0x1"])(
    "GET /boxes/%s is a 404 not_found with the status and starts no read",
    async (n) => {
      const { adapter, app } = setup();
      await flush();
      const response = await get(app, `/boxes/${n}`);
      expect(response.status).toBe(404);
      const body = ErrorBody.parse(await response.json());
      expect(body.error.code).toBe("not_found");
      expect(body.status.state).toBe("game");
      expect(adapter.boxRequests).toHaveLength(0);
    },
  );

  test("the state codes come before `:n` validation", async () => {
    const { adapter, app } = setup();
    await flush();
    adapter.set({ ...CONNECTED, game: null, gameEpoch: 2 });
    await flush();
    const response = await get(app, "/boxes/abc");
    expect(response.status).toBe(503);
    expect(ErrorBody.parse(await response.json()).error.code).toBe("no_game");
  });

  test("a first read that gets nothing is a 503 no_data, for both routes", async () => {
    const { adapter, app } = setup();
    await flush();
    adapter.boxOutcome = "timeout";
    for (const path of ["/boxes", "/boxes/0"]) {
      const response = await get(app, path);
      expect(response.status).toBe(503);
      expect(ErrorBody.parse(await response.json()).error.code).toBe("no_data");
    }
  });

  test("a storage block that can't be read gives 14 unreadable boxes and no current box", async () => {
    const { adapter, app } = setup();
    await flush();
    adapter.point(null);
    const boxes = Boxes.parse(await (await get(app, "/boxes")).json());
    expect(boxes.currentBox).toBeNull();
    expect(boxes.boxes).toHaveLength(STORAGE.boxCount);
    expect(
      boxes.boxes.every((box) => !box.readable && box.slots.length === 0),
    ).toBe(true);
    const one = Box.parse(await (await get(app, "/boxes/5")).json());
    expect(one.readable).toBe(false);
  });
});

describe("box reads in the loop", () => {
  test("nothing reads boxes until a GET demands them", async () => {
    const { adapter, tick } = setup();
    await tick(2000);
    expect(adapter.boxRequests).toHaveLength(0);
  });

  test("a cold read sends the pointer word, then the storage block, with the box timeout", async () => {
    const { adapter, loop } = setup();
    await flush();
    await loop.get("boxes");
    const [words, batch, ...more] = adapter.boxRequests;
    expect(more).toEqual([]);
    expect(words).toEqual([
      { domain: "iwram", offset: POINTER_WORD, length: 4 },
    ]);
    expect(
      batch?.some((r) => r.domain === "ewram" && r.length === STORAGE.size),
    ).toBe(true);
    expect(
      adapter.reads.every((r) => r.timeoutMs === 250 || r.timeoutMs === 1000),
    ).toBe(true);
  });

  test("while demanded, boxes are read at most once per 1000 ms", async () => {
    const { adapter, loop, tick } = setup();
    await flush();
    await loop.get("boxes");
    const cold = adapter.boxRequests.length;
    await tick(950);
    expect(adapter.boxRequests).toHaveLength(cold);
    await tick(100);
    // One steady-state request: the pointer value is known now.
    expect(adapter.boxRequests).toHaveLength(cold + 1);
    await tick(900);
    expect(adapter.boxRequests).toHaveLength(cold + 1);
    await tick(100);
    expect(adapter.boxRequests).toHaveLength(cold + 2);
  });

  test("the reads stop once the 5 s demand window passes", async () => {
    const { adapter, loop, tick } = setup();
    await flush();
    await loop.get("boxes");
    await tick(7000, 250);
    const after = adapter.boxRequests.length;
    await tick(3000);
    expect(adapter.boxRequests).toHaveLength(after);
  });

  test("a warm GET under a second old reuses the cache and reads nothing", async () => {
    const { adapter, loop, tick } = setup();
    await flush();
    await loop.get("boxes");
    const before = adapter.boxRequests.length;
    await tick(500);
    await loop.get("boxes");
    await loop.box("0");
    expect(adapter.boxRequests).toHaveLength(before);
  });

  test("concurrent stale GETs share one read", async () => {
    const { adapter, loop } = setup();
    await flush();
    await Promise.all([loop.get("boxes"), loop.get("boxes"), loop.box("1")]);
    // One cold read: the pointer words, then the storage block.
    expect(adapter.boxRequests).toHaveLength(2);
  });

  test("the main batch is read and decoded before the box request starts", async () => {
    const { adapter, loop, tick } = setup();
    await flush();
    await loop.get("party");
    await loop.get("boxes");
    await tick(1000);
    adapter.reads.length = 0;
    // The party changes, and the box read that follows in the same cycle hangs.
    adapter.memory.ewram[0x244e9] = 0;
    adapter.boxOutcome = "hang";
    await tick(1000);
    const order = adapter.reads.map((r) =>
      r.timeoutMs === BOX_TIMEOUT ? "box" : "main",
    );
    const firstBox = order.indexOf("box");
    expect(firstBox).toBeGreaterThan(0);
    expect(order.slice(firstBox).every((x) => x === "box")).toBe(true);
    // The main batch's value is already served while the box request is open.
    const party = await loop.get("party");
    expect(party.ok && party.value.pokemon).toEqual([]);
    adapter.release();
    await flush();
  });

  test("a game change during a box read waits for it", async () => {
    const { adapter, loop } = setup();
    await flush();
    adapter.boxOutcome = "hang";
    const pending = loop.get("boxes");
    await flush();
    const before = adapter.reads.length;
    adapter.set({ ...CONNECTED, gameEpoch: 2 });
    await flush();
    // Identification of the new game is queued behind the box request.
    expect(adapter.reads).toHaveLength(before);
    adapter.release();
    await flush();
    expect(adapter.reads.length).toBeGreaterThan(before);
    expect((await pending).ok).toBe(false);
  });
});

describe("a stale GET and a box timeout", () => {
  test("a stale cache is read again at once, and a changed block shows", async () => {
    const { adapter, loop, tick } = setup();
    await flush();
    await loop.get("boxes");
    await tick(7000, 250);
    adapter.putStorage(STORAGE_AT, storageBytes({ currentBox: 7 }));
    const got = await loop.get("boxes");
    expect(got.ok && got.value.currentBox).toBe(7);
  });

  test("a timed-out read returns the stale cache, not a 503", async () => {
    const { adapter, loop, tick } = setup();
    await flush();
    await loop.get("boxes");
    await tick(7000, 250);
    adapter.boxOutcome = "timeout";
    const before = adapter.boxRequests.length;
    const got = await loop.get("boxes");
    expect(adapter.boxRequests.length).toBeGreaterThan(before);
    expect(got.ok && got.value.currentBox).toBe(2);
    const one = await loop.box("0");
    expect(one.ok && one.value.slots[0]?.nickname).toBe("ZERO");
  });

  test("a read that hangs is waited for about 2.25 s, then the stale cache is returned", async () => {
    const { adapter, clock, loop, tick } = setup();
    await flush();
    await loop.get("boxes");
    await tick(7000, 250);
    adapter.boxOutcome = "hang";
    let settled = false;
    const pending = loop.get("boxes").then((got) => {
      settled = true;
      return got;
    });
    await flush();
    clock.advance(2200);
    await flush();
    expect(settled).toBe(false);
    clock.advance(50);
    await flush();
    expect(settled).toBe(true);
    const got = await pending;
    expect(got.ok && got.value.currentBox).toBe(2);
    adapter.release();
    await flush();
  });

  test("a hung first read gives a 503 no_data after the wait", async () => {
    const { adapter, clock, loop } = setup();
    await flush();
    adapter.boxOutcome = "hang";
    const pending = loop.get("boxes");
    await flush();
    clock.advance(2250);
    await flush();
    const got = await pending;
    expect(!got.ok && got.code).toBe("no_data");
    adapter.release();
    await flush();
  });

  test("a stale GET goes ahead of a box request that has not started", async () => {
    const { adapter, loop, tick } = setup();
    await flush();
    await loop.get("boxes");
    await tick(7000, 250);
    // Demand is back and the next tick's box read is due, then a stale GET lands first.
    adapter.reads.length = 0;
    const got = await loop.get("boxes");
    expect(got.ok).toBe(true);
    const count = adapter.boxRequests.length;
    await tick(100);
    // The GET's read made the cache fresh, so the tick's read was skipped.
    expect(adapter.boxRequests).toHaveLength(count);
  });
});

describe("the minimum interval holds for GETs too", () => {
  test("a read that failed fast is not retried by a GET inside the second", async () => {
    const { adapter, loop, tick } = setup();
    await flush();
    await loop.get("boxes");
    adapter.putStorage(
      OTHER_STORAGE_AT,
      storageBytes({ currentBox: 9 }),
      false,
    );
    adapter.point(OTHER_STORAGE_AT);
    // The tick's read at 1000 ms sees the pointer move and is dropped, leaving the cache stale.
    await tick(1050);
    const count = adapter.boxRequests.length;
    const got = await loop.get("boxes");
    expect(adapter.boxRequests).toHaveLength(count);
    expect(got.ok && got.value.currentBox).toBe(2);
  });
});

describe("hashing the raw bytes", () => {
  test("an unchanged block keeps the cached value, and a changed one replaces it", async () => {
    const { adapter, loop, tick } = setup();
    await flush();
    const first = await loop.get("boxes");
    await tick(3000);
    const second = await loop.get("boxes");
    expect(first.ok && second.ok && second.value === first.value).toBe(true);
    adapter.putStorage(
      STORAGE_AT,
      storageBytes({ currentBox: 2, names: { 0: "NEW" } }),
    );
    await tick(1100);
    const third = await loop.get("boxes");
    expect(third.ok && third.value !== (first.ok && first.value)).toBe(true);
    expect(third.ok && third.value.boxes[0]?.name).toBe("NEW");
  });
});

describe("a pointer change", () => {
  test("drops the read that used the old address, then reads the new one", async () => {
    const { adapter, loop, tick } = setup();
    await flush();
    await loop.get("boxes");
    // The old target changes too, so a read that used it would show currentBox 4.
    adapter.putStorage(STORAGE_AT, storageBytes({ currentBox: 4 }), false);
    adapter.putStorage(
      OTHER_STORAGE_AT,
      storageBytes({ currentBox: 9 }),
      false,
    );
    adapter.point(OTHER_STORAGE_AT);
    // The tick's read addresses the old target and sees the pointer move, so it is dropped.
    await tick(1000);
    const [moved] = adapter.boxRequests.slice(-1);
    expect(moved?.some((r) => r.offset === STORAGE_AT)).toBe(true);
    const kept = await loop.get("boxes");
    expect(kept.ok && kept.value.currentBox).toBe(2);
    // The next read addresses the new target.
    await tick(1000);
    const [next] = adapter.boxRequests.slice(-1);
    expect(next?.some((r) => r.offset === OTHER_STORAGE_AT)).toBe(true);
    const later = await loop.get("boxes");
    expect(later.ok && later.value.currentBox).toBe(9);
  });

  test("the box request keeps its own pointer cache, apart from the main batch", async () => {
    const { adapter, loop } = setup();
    await flush();
    await loop.get("party");
    // Main batch pointer words are known now, the box pointer is not: the cold box read still sends two requests.
    await loop.get("boxes");
    expect(adapter.boxRequests).toHaveLength(2);
  });
});

describe("corrupt boxed Pokémon", () => {
  test("warn once per slot, and read as null with the slot listed", async () => {
    const warnings: object[] = [];
    const log: Log = {
      ...silentLog(),
      warn: (_message, data) => {
        if (data) warnings.push(data);
      },
    };
    const { adapter, loop, tick } = setup(log);
    await flush();
    const bytes = storageBytes({
      currentBox: 0,
      slots: { 3: { 4: encodeMon(mon(277, "BAD")) } },
    });
    const at = STORAGE.boxes + (3 * STORAGE.slotCount + 4) * 80;
    bytes[at + 40] = (bytes[at + 40] ?? 0) ^ 0xff;
    adapter.putStorage(STORAGE_AT, bytes);
    const got = await loop.get("boxes");
    expect(got.ok && got.value.boxes[3]?.corruptSlots).toEqual([4]);
    expect(got.ok && got.value.boxes[3]?.slots[4]).toBeNull();
    // A change elsewhere decodes again, and the same slot doesn't warn twice.
    bytes[STORAGE.currentBox] = 5;
    adapter.putStorage(STORAGE_AT, bytes);
    await tick(1100);
    expect(warnings).toEqual([{ box: 3, slot: 4 }]);
  });
});
