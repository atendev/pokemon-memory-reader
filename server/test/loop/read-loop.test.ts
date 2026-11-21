import { afterEach, describe, expect, test } from "bun:test";
import { Battle } from "@pokemon-memory-reader/api/schemas";
import type {
  Adapter,
  AdapterState,
  Range,
  ReadOutcome,
} from "../../src/adapter/types";
import { createApp } from "../../src/app/app";
import type { BoundGame } from "../../src/format/registry";
import { ok } from "../../src/format/types";
import { silentLog } from "../../src/log";
import { createReadLoop, normalizePollHz } from "../../src/loop/read-loop";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import { ManualClock } from "../bridge/manual-clock";
import {
  type BattleMonSpec,
  endBattle,
  writeBattle,
} from "../gen3/battle-encode";
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

  /** Reads that asked for party bytes (gPlayerParty at EWRAM 0x244ec), as opposed to the header or the battle flag. */
  get partyReads(): number {
    return this.reads.filter((r) =>
      r.some(
        (x) =>
          x.domain === "ewram" &&
          x.offset <= PARTY_AT &&
          x.offset + x.length > PARTY_AT,
      ),
    ).length;
  }
}

const PARTY_AT = 0x244ec;

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
  test("identifies from the header and reads only the in-battle flag without demand", async () => {
    const { adapter, clock, loop } = setup();
    await flush();
    expect(loop.status().state).toBe("game");
    for (let i = 0; i < 10; i++) {
      clock.advance(50);
      await flush();
    }
    expect(adapter.partyReads).toBe(0);
    const [header, ...ticks] = adapter.reads;
    expect(header?.length).toBeGreaterThan(0);
    expect(ticks.length).toBeGreaterThan(5);
    for (const request of ticks) {
      // The flag and the outcome byte, one byte each.
      expect(request.map((x) => x.length)).toEqual([1, 1]);
    }
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

const MON: BattleMonSpec = {
  species: 277,
  level: 5,
  hp: 19,
  maxHp: 20,
  moves: [33],
  pp: [35],
  types: [12, 12],
};
const FOE: BattleMonSpec = { ...MON, species: 261, level: 3, types: [17, 17] };
const FOE_MON = { ...TREECKO, species: 261, level: 3, nickname: "" };
const TRAINER = 1 << 3;
const DOUBLE = 1 << 0;

const tick = async (clock: ManualClock, times = 2) => {
  for (let i = 0; i < times; i++) {
    clock.advance(50);
    await flush();
  }
};

const battle = async (loop: ReturnType<typeof setup>["loop"]) => {
  const got = await loop.get("battle");
  if (!got.ok) throw new Error(got.code);
  return got.value;
};

describe("the battle resource in the loop", () => {
  test("out of battle it is the inactive shape with no last battle", async () => {
    const { loop } = setup();
    await flush();
    const value = await battle(loop);
    expect(Battle.parse(value)).toEqual({ active: false, lastBattle: null });
  });

  test("a synthetic single wild battle is a valid active shape", async () => {
    const { adapter, clock, loop } = setup();
    await flush();
    writeBattle(adapter.memory, {
      typeFlags: 0,
      battlers: [MON, FOE],
      partyIndexes: [0, 0],
      enemyParty: [FOE_MON],
    });
    await tick(clock);
    const value = Battle.parse(await battle(loop));
    if (!value.active) throw new Error("expected an active battle");
    expect(value.kind).toBe("wild");
    expect(value.format).toBe("single");
    expect(value.battleId).toBe(1);
    expect(value.player.active).toHaveLength(1);
    expect(value.opponent.active[0]?.species.id).toBe(261);
    expect(value.opponent.party).toHaveLength(1);
  });

  test("a synthetic double trainer battle is a valid active shape", async () => {
    const { adapter, clock, loop } = setup();
    await flush();
    writeBattle(adapter.memory, {
      typeFlags: TRAINER | DOUBLE,
      battlers: [MON, FOE, { ...MON, species: 280 }, { ...FOE, species: 263 }],
      partyIndexes: [0, 0, 1, 1],
      enemyParty: [FOE_MON, { ...FOE_MON, species: 263 }],
    });
    await tick(clock);
    const value = Battle.parse(await battle(loop));
    if (!value.active) throw new Error("expected an active battle");
    expect(value.kind).toBe("trainer");
    expect(value.format).toBe("double");
    expect(value.player.active).toHaveLength(2);
    expect(value.opponent.active).toHaveLength(2);
    expect(value.opponent.party).toHaveLength(2);
  });

  test("a flag that reads set gets its frame in a second request within the tick", async () => {
    const { adapter, clock, loop } = setup();
    await flush();
    await tick(clock, 2);
    writeBattle(adapter.memory, {
      typeFlags: 0,
      battlers: [MON, FOE],
      partyIndexes: [0, 0],
      enemyParty: [FOE_MON],
    });
    const before = adapter.reads.length;
    await tick(clock, 1);
    const requests = adapter.reads.slice(before);
    expect(requests).toHaveLength(2);
    expect(requests[1]?.length).toBeGreaterThan(requests[0]?.length ?? 0);
    expect((await battle(loop)).active).toBe(true);
  });

  test("the battle is read with no subscriber, so lastBattle is complete when first asked", async () => {
    const { adapter, clock, loop } = setup();
    await flush();
    writeBattle(adapter.memory, {
      typeFlags: TRAINER,
      battlers: [MON, FOE],
      partyIndexes: [0, 0],
      enemyParty: [FOE_MON],
    });
    await tick(clock, 5);
    endBattle(adapter.memory, 1);
    await tick(clock, 2);

    // Nothing has asked for the battle until now.
    const value = Battle.parse(await battle(loop));
    if (value.active) throw new Error("expected the battle to have ended");
    expect(value.lastBattle).toMatchObject({
      battleId: 1,
      outcome: "won",
      kind: "trainer",
    });
    expect(value.lastBattle?.opponentParty[0]?.species.id).toBe(261);
  });

  test("a second battle takes the next battleId and replaces lastBattle", async () => {
    const { adapter, clock, loop } = setup();
    await flush();
    const scene = {
      typeFlags: 0,
      battlers: [MON, FOE],
      partyIndexes: [0, 0],
      enemyParty: [FOE_MON],
    };
    writeBattle(adapter.memory, scene);
    await tick(clock);
    endBattle(adapter.memory, 4);
    await tick(clock);
    writeBattle(adapter.memory, scene);
    await tick(clock);
    const value = await battle(loop);
    expect(value).toMatchObject({ active: true, battleId: 2 });
    endBattle(adapter.memory, 7);
    await tick(clock);
    expect(await battle(loop)).toMatchObject({
      active: false,
      lastBattle: { battleId: 2, outcome: "caught" },
    });
  });

  test("a game change resets battleId and lastBattle", async () => {
    const { adapter, clock, loop } = setup();
    await flush();
    writeBattle(adapter.memory, {
      typeFlags: 0,
      battlers: [MON, FOE],
      partyIndexes: [0, 0],
      enemyParty: [FOE_MON],
    });
    await tick(clock);
    endBattle(adapter.memory, 1);
    await tick(clock);
    expect(await battle(loop)).toMatchObject({
      lastBattle: { battleId: 1 },
    });

    adapter.memory = emeraldMemory([TREECKO]);
    adapter.set({ ...CONNECTED, gameEpoch: 2 });
    await flush();
    expect(await battle(loop)).toEqual({ active: false, lastBattle: null });
  });

  test("GET /api/v2/battle serves the value from the loop", async () => {
    const { adapter, clock, loop } = setup();
    await flush();
    const app = createApp({ resources: loop });
    const inactive = await app.request("/api/v2/battle");
    expect(inactive.status).toBe(200);
    expect(await inactive.json()).toEqual({ active: false, lastBattle: null });

    writeBattle(adapter.memory, {
      typeFlags: 0,
      battlers: [MON, FOE],
      partyIndexes: [0, 0],
      enemyParty: [FOE_MON],
    });
    await tick(clock);
    const active = await app.request("/api/v2/battle");
    expect(Battle.parse(await active.json())).toMatchObject({ active: true });
  });

  test("a disconnected adapter refuses with disconnected", async () => {
    const { adapter, loop } = setup();
    await flush();
    adapter.set({ ...CONNECTED, connection: "disconnected", game: null });
    expect(await loop.get("battle")).toMatchObject({
      ok: false,
      code: "disconnected",
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
