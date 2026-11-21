import { afterEach, describe, expect, test } from "bun:test";
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

/** One byte of EWRAM stands for the boxes, so a test changes them by writing it. */
const AT = 0x5000;
const bound = (): BoundGame => ({
  boxes: {
    count: 1,
    regions: {
      body: {
        kind: "static",
        at: { domain: "ewram", offset: AT },
        length: 1,
      },
    },
    decode: (slices) =>
      ok({ currentBox: slices.body?.u8(0) ?? 0, boxes: [] } as never),
  },
});

describe("the boxes topic on the stream", () => {
  test("pushes at most once a second, whatever the poll rate, and again after a game change", async () => {
    const adapter = new ScriptedAdapter();
    const clock = new ManualClock();
    const loop = createReadLoop({
      adapter,
      registry,
      pollHz: 5,
      clock,
      log: silentLog,
      bind: bound,
    });
    open.push(loop);
    const events: ChangeEvent[] = [];
    loop.onChange((event) => {
      if (event.topic === "boxes") events.push(event);
    });
    await flush();
    loop.retain(["boxes"]);
    const first = await loop.get("boxes");
    expect(first.ok).toBe(true);
    const start = events.length;

    // The box changes at every 200 ms tick for 10 s. Ten pushes is the most the cap allows.
    for (let i = 1; i <= 50; i++) {
      adapter.memory.ewram[AT] = i;
      clock.advance(200);
      await flush();
    }
    const pushed = events.length - start;
    expect(pushed).toBeGreaterThan(5);
    expect(pushed).toBeLessThanOrEqual(10);

    // A new game reads its boxes at once, inside the second.
    const before = events.length;
    adapter.memory.ewram[AT] = 99;
    adapter.set({ ...CONNECTED, gameEpoch: 2 });
    for (let i = 0; i < 3; i++) {
      clock.advance(200);
      await flush();
    }
    expect(events.length).toBeGreaterThan(before);
  });
});
