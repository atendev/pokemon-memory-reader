import { afterEach, describe, expect, test } from "bun:test";
import type { StatusResource } from "@pokemon-memory-reader/api/schemas";
import type { ReadOutcome } from "../../src/adapter/types";
import { type BoundGame, bindGame } from "../../src/format/registry";
import { fail, ok } from "../../src/format/types";
import { silentLog } from "../../src/log";
import { type ChangeEvent, createReadLoop } from "../../src/loop/read-loop";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import type { Profile } from "../../src/profile/schema";
import { ManualClock } from "../bridge/manual-clock";
import { endBattle, writeBattle } from "../gen3/battle-encode";
import { emeraldMemory, TREECKO } from "../support/emerald-memory";
import { CONNECTED, ScriptedAdapter } from "../support/scripted-adapter";

const { registry } = loadProfiles({ builtin: [emerald], user: [] });

const TIMEOUT: ReadOutcome = { kind: "timeout" };
const BRIDGE_ERROR: ReadOutcome = { kind: "failed", reason: "bridge_error" };

const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};

const open: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const loop of open.splice(0)) await loop.close();
});

function setup(
  options: { pollHz?: number; bind?: (profile: Profile) => BoundGame } = {},
) {
  const adapter = new ScriptedAdapter();
  const clock = new ManualClock();
  const loop = createReadLoop({
    adapter,
    registry,
    pollHz: options.pollHz ?? 20,
    clock,
    log: silentLog,
    ...(options.bind && { bind: options.bind }),
  });
  open.push(loop);
  /** Resource events. `status` events go to `statuses`, because they follow the adapter's state too (spec §7.3). */
  const events: ChangeEvent[] = [];
  const statuses: StatusResource[] = [];
  loop.onChange((event) => {
    if (event.topic === "status") statuses.push(event.value);
    else events.push(event);
  });
  return { adapter, clock, loop, events, statuses };
}

const tick = async (clock: ManualClock, times = 2) => {
  for (let i = 0; i < times; i++) {
    clock.advance(50);
    await flush();
  }
};

/** A party read from two bytes at EWRAM 0x5000. Byte 0 is the size, byte 1 is ignored, and 0xff fails validation. */
const AT = 0x5000;
const counts = { decodes: 0 };
const sized = (): BoundGame => ({
  party: {
    regions: {
      body: {
        kind: "static",
        at: { domain: "ewram", offset: AT },
        length: 2,
      },
    },
    decode: (slices) => {
      counts.decodes++;
      const size = slices.body?.u8(0) ?? 0;
      return size === 0xff
        ? fail("size is 0xff")
        : ok({ pokemon: new Array(size).fill({}) } as never);
    },
  },
});
const sizeOf = async (loop: ReturnType<typeof setup>["loop"]) => {
  const got = await loop.get("party");
  return got.ok ? got.value.pokemon.length : got.code;
};

describe("change detection", () => {
  test("the first decode emits, and bytes equal to the last tick's skip the decode", async () => {
    counts.decodes = 0;
    const { adapter, clock, loop, events } = setup({ bind: sized });
    adapter.memory.ewram[AT] = 3;
    await flush();
    expect(await sizeOf(loop)).toBe(3);
    expect(counts.decodes).toBe(1);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ topic: "party" });
    // The on-connect value is the value a GET serves.
    expect(events[0]?.value as unknown).toEqual({ pokemon: [{}, {}, {}] });

    const reads = adapter.reads;
    await tick(clock, 6);
    expect(adapter.reads).toBeGreaterThan(reads);
    expect(counts.decodes).toBe(1);
    expect(events).toHaveLength(1);
  });

  test("bytes that differ but decode to the same value emit nothing", async () => {
    counts.decodes = 0;
    const { adapter, clock, loop, events } = setup({ bind: sized });
    adapter.memory.ewram[AT] = 3;
    await flush();
    await sizeOf(loop);

    // Byte 1 is ignored: the raw bytes change and the value doesn't.
    adapter.memory.ewram[AT + 1] = 9;
    await tick(clock, 2);
    expect(counts.decodes).toBe(2);
    expect(events).toHaveLength(1);

    adapter.memory.ewram[AT] = 4;
    await tick(clock, 2);
    expect(counts.decodes).toBe(3);
    expect(events).toHaveLength(2);
    expect(events[1]?.value as unknown).toEqual({ pokemon: [{}, {}, {}, {}] });
    expect(await sizeOf(loop)).toBe(4);
  });

  test("a failed decode emits nothing and leaves state unchanged", async () => {
    counts.decodes = 0;
    const { adapter, clock, loop, events } = setup({ bind: sized });
    adapter.memory.ewram[AT] = 3;
    await flush();
    await sizeOf(loop);

    adapter.memory.ewram[AT] = 0xff;
    await tick(clock, 3);
    // The bad bytes are decoded again every tick, and the value served is the last good one.
    expect(counts.decodes).toBeGreaterThanOrEqual(3);
    expect(events).toHaveLength(1);
    expect(await sizeOf(loop)).toBe(3);

    // The bytes return to what was last decoded, so there is nothing to decode or emit.
    const decodes = counts.decodes;
    adapter.memory.ewram[AT] = 3;
    await tick(clock, 3);
    expect(counts.decodes).toBe(decodes);
    expect(events).toHaveLength(1);
  });

  test("a cold GET after demand lapsed emits only when the value differs", async () => {
    counts.decodes = 0;
    const { adapter, clock, loop, events } = setup({ bind: sized });
    adapter.memory.ewram[AT] = 3;
    await flush();
    await sizeOf(loop);

    clock.advance(5100);
    await flush();
    expect(await sizeOf(loop)).toBe(3);
    expect(events).toHaveLength(1);

    clock.advance(5100);
    await flush();
    adapter.memory.ewram[AT] = 5;
    expect(await sizeOf(loop)).toBe(5);
    expect(events).toHaveLength(2);
  });

  test("the real Emerald party emits when a level changes and not before", async () => {
    const { adapter, clock, loop, events } = setup();
    await flush();
    await loop.get("party");
    await tick(clock, 4);
    const parties = () => events.filter((e) => e.topic === "party");
    expect(parties()).toHaveLength(1);

    adapter.memory = emeraldMemory([{ ...TREECKO, level: 6 }]);
    await tick(clock, 2);
    expect(parties()).toHaveLength(2);
    const last = parties()[1];
    expect(last?.topic === "party" && last.value.pokemon[0]?.level).toBe(6);
  });

  test("the battle emits its first value, each change and nothing in between", async () => {
    const { adapter, clock, events } = setup();
    await flush();
    await tick(clock, 4);
    const battles = () =>
      events.flatMap((e) => (e.topic === "battle" ? [e.value] : []));
    expect(battles()).toEqual([{ active: false, lastBattle: null }]);

    const mon = {
      species: 277,
      level: 5,
      hp: 19,
      maxHp: 20,
      moves: [33],
      pp: [35],
      types: [12, 12] as [number, number],
    };
    const foe = {
      ...mon,
      species: 261,
      level: 3,
      types: [17, 17] as [number, number],
    };
    const foeMon = { ...TREECKO, species: 261, level: 3, nickname: "" };
    writeBattle(adapter.memory, {
      typeFlags: 0,
      battlers: [mon, foe],
      partyIndexes: [0, 0],
      enemyParty: [foeMon],
    });
    await tick(clock, 4);
    expect(battles()).toHaveLength(2);
    expect(battles()[1]).toMatchObject({ active: true, battleId: 1 });

    // The flag stays in the raw key, so the flip to clear always decodes.
    endBattle(adapter.memory, 1);
    await tick(clock, 4);
    expect(battles()).toHaveLength(3);
    expect(battles()[2]).toMatchObject({ active: false });
    await tick(clock, 4);
    expect(battles()).toHaveLength(3);
  });
});

describe("stalled", () => {
  const stalled = (loop: ReturnType<typeof setup>["loop"]) =>
    loop.status().adapter?.stalled;
  /** The `stalled` value of each status event. The first is the identification's. */
  const statusEvents = (statuses: StatusResource[]) =>
    statuses.map((status) => status.adapter?.stalled);

  test("1 s of consecutive timeouts sets it, and the next good read clears it", async () => {
    const { adapter, clock, loop, statuses } = setup();
    await flush();
    expect(stalled(loop)).toBe(false);

    adapter.respond = () => TIMEOUT;
    await tick(clock, 18);
    expect(stalled(loop)).toBe(false);
    await tick(clock, 4);
    expect(stalled(loop)).toBe(true);
    expect(statusEvents(statuses)).toEqual([false, true]);

    adapter.respond = () => null;
    await tick(clock, 2);
    expect(stalled(loop)).toBe(false);
    expect(statusEvents(statuses)).toEqual([false, true, false]);
  });

  test("a good read in the middle starts the count again", async () => {
    const { adapter, clock, loop } = setup();
    await flush();
    adapter.respond = () => TIMEOUT;
    await tick(clock, 12);
    adapter.respond = () => null;
    await tick(clock, 2);
    adapter.respond = () => TIMEOUT;
    await tick(clock, 12);
    expect(stalled(loop)).toBe(false);
    await tick(clock, 10);
    expect(stalled(loop)).toBe(true);
  });

  test("a timeout after a pause with no batches starts a new run", async () => {
    const { adapter, loop, clock } = setup({
      pollHz: 5,
      bind: () => ({ party: sized().party as never }),
    });
    await flush();
    adapter.respond = () => TIMEOUT;
    expect(await sizeOf(loop)).toBe("no_data");
    // Nothing is demanded, so no batch runs for a minute.
    adapter.respond = () => null;
    clock.advance(60_000);
    adapter.respond = () => TIMEOUT;
    expect(await sizeOf(loop)).toBe("no_data");
    expect(stalled(loop)).toBe(false);
  });

  test("a bridge error after a pause doesn't carry the old run over", async () => {
    const { adapter, loop, clock } = setup({
      pollHz: 5,
      bind: () => ({ party: sized().party as never }),
    });
    await flush();
    adapter.respond = () => TIMEOUT;
    expect(await sizeOf(loop)).toBe("no_data");
    clock.advance(60_000);
    adapter.respond = () => BRIDGE_ERROR;
    expect(await sizeOf(loop)).toBe("no_data");
    adapter.respond = () => TIMEOUT;
    expect(await sizeOf(loop)).toBe("no_data");
    expect(stalled(loop)).toBe(false);
  });

  test("a cold read's timeout counts", async () => {
    // Ticks answer with a bridge error, which counts as neither, so only the cold GETs time out.
    const { adapter, clock, loop } = setup({
      pollHz: 5,
      bind: () => ({ party: sized().party as never }),
    });
    await flush();
    adapter.respond = () => TIMEOUT;
    expect(await sizeOf(loop)).toBe("no_data");
    expect(stalled(loop)).toBe(false);

    adapter.respond = () => BRIDGE_ERROR;
    for (let i = 0; i < 6; i++) {
      clock.advance(200);
      await flush();
    }
    expect(stalled(loop)).toBe(false);

    // Only this cold read can complete the run the first one began at 0.
    adapter.respond = () => TIMEOUT;
    expect(await sizeOf(loop)).toBe("no_data");
    expect(stalled(loop)).toBe(true);
  });

  test("box timeouts never count", async () => {
    const { adapter, clock, loop } = setup({
      bind: (profile) => ({ boxes: bindGame(profile).boxes }),
    });
    await flush();
    adapter.respond = () => TIMEOUT;
    const scripted = adapter.scripted;
    void loop.get("boxes");
    await tick(clock, 60);
    expect(adapter.scripted).toBeGreaterThan(scripted + 1);
    expect(stalled(loop)).toBe(false);
  });

  test("bridge errors never count", async () => {
    const { adapter, clock, loop } = setup();
    await flush();
    adapter.respond = () => BRIDGE_ERROR;
    await tick(clock, 40);
    expect(adapter.scripted).toBeGreaterThan(10);
    expect(stalled(loop)).toBe(false);
  });

  test("a bridge error between timeouts neither counts nor ends the run", async () => {
    const { adapter, clock, loop } = setup();
    await flush();
    adapter.respond = () => TIMEOUT;
    await tick(clock, 12);
    adapter.respond = () => BRIDGE_ERROR;
    await tick(clock, 4);
    adapter.respond = () => TIMEOUT;
    await tick(clock, 4);
    expect(stalled(loop)).toBe(false);
    await tick(clock, 4);
    expect(stalled(loop)).toBe(true);
  });

  test("a new game starts without it", async () => {
    const { adapter, clock, loop } = setup();
    await flush();
    adapter.respond = () => TIMEOUT;
    await tick(clock, 24);
    expect(stalled(loop)).toBe(true);
    adapter.set({ ...CONNECTED, gameEpoch: 2 });
    expect(stalled(loop)).toBe(false);
  });
});
