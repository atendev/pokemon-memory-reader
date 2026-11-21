import { afterEach, describe, expect, test } from "bun:test";
import type { StatusResource } from "@pokemon-memory-reader/api/schemas";
import type { BoundGame } from "../../src/format/registry";
import { ok } from "../../src/format/types";
import { silentLog } from "../../src/log";
import { type ChangeEvent, createReadLoop } from "../../src/loop/read-loop";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import { ManualClock } from "../bridge/manual-clock";
import { CONNECTED, ScriptedAdapter } from "../support/scripted-adapter";

const { registry } = loadProfiles({ builtin: [emerald], user: [] });

const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};

const open: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const loop of open.splice(0)) await loop.close();
});

/** A party of byte 0 empty mons at EWRAM 0x5000. It binds no battle, so nothing is read while nothing is demanded. */
const AT = 0x5000;
const sized = (): BoundGame => ({
  party: {
    regions: {
      body: {
        kind: "static",
        at: { domain: "ewram", offset: AT },
        length: 2,
      },
    },
    decode: (slices) =>
      ok({ pokemon: new Array(slices.body?.u8(0) ?? 0).fill({}) } as never),
  },
});

/** `advance(1000)` runs one tick, because a tick is scheduled once the one before it settles. */
function setup() {
  const adapter = new ScriptedAdapter();
  const clock = new ManualClock();
  const loop = createReadLoop({
    adapter,
    registry,
    pollHz: 5,
    clock,
    log: silentLog,
    bind: sized,
  });
  open.push(loop);
  const events: ChangeEvent[] = [];
  const statuses: StatusResource[] = [];
  loop.onChange((event) => {
    if (event.topic === "status") statuses.push(event.value);
    else events.push(event);
  });
  return { adapter, clock, loop, events, statuses };
}

const seconds = async (clock: ManualClock, count: number) => {
  for (let i = 0; i < count; i++) {
    clock.advance(1000);
    await flush();
  }
};

describe("SSE demand", () => {
  test("a subscriber keeps its topic read past the warm window, which then starts when the last one leaves", async () => {
    const { adapter, clock, loop } = setup();
    await flush();
    adapter.memory.ewram[AT] = 3;
    const first = loop.retain(["party"]);
    const second = loop.retain(["party", "status"]);
    await seconds(clock, 12);
    const whileSubscribed = adapter.reads;

    await seconds(clock, 3);
    expect(adapter.reads).toBeGreaterThan(whileSubscribed);

    // One subscriber is still there.
    first();
    first();
    let before = adapter.reads;
    await seconds(clock, 8);
    expect(adapter.reads).toBeGreaterThan(before);

    // The last one leaves: reads go on for the 5 s window, then stop.
    second();
    before = adapter.reads;
    await seconds(clock, 4);
    expect(adapter.reads).toBeGreaterThan(before);
    await seconds(clock, 3);
    before = adapter.reads;
    await seconds(clock, 5);
    expect(adapter.reads).toBe(before);
  });

  test("a subscriber to a topic whose demand lapsed gets a fresh value, not the cached one", async () => {
    const { adapter, clock, loop, events } = setup();
    await flush();
    adapter.memory.ewram[AT] = 3;
    const release = loop.retain(["party"]);
    const first = await loop.get("party");
    expect(first.ok && first.value.pokemon.length).toBe(3);
    release();
    await seconds(clock, 10);

    adapter.memory.ewram[AT] = 5;
    const before = events.length;
    loop.retain(["party"]);
    const cold = await loop.get("party");
    expect(cold.ok && cold.value.pokemon.length).toBe(5);
    expect(events).toHaveLength(before + 1);
  });

  test("a topic with no data yet is held until the first decode, which arrives as a change event", async () => {
    const { adapter, clock, loop, events } = setup();
    adapter.set({ ...CONNECTED, connection: "disconnected" });
    await flush();
    loop.retain(["party"]);
    const refused = await loop.get("party");
    expect(refused).toMatchObject({ ok: false, code: "disconnected" });
    expect(events).toHaveLength(0);

    adapter.memory.ewram[AT] = 2;
    adapter.set({ ...CONNECTED, gameEpoch: 2 });
    await seconds(clock, 3);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ topic: "party" });
  });

  test("an adapter state change or a finished identification emits a status event, and an unchanged status doesn't", async () => {
    const { adapter, clock, statuses } = setup();
    await flush();
    expect(statuses.map((status) => status.state)).toEqual(["game"]);

    adapter.set({ ...CONNECTED });
    await seconds(clock, 2);
    expect(statuses).toHaveLength(1);

    adapter.set({ ...CONNECTED, connection: "disconnected" });
    await flush();
    expect(statuses.map((status) => status.state)).toEqual([
      "game",
      "disconnected",
    ]);
  });
});
