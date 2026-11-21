import { afterEach, describe, expect, test } from "bun:test";
import { createRetroArchAdapter } from "../../src/adapter/retroarch/adapter";
import { silentLog } from "../../src/log";
import { createReadLoop } from "../../src/loop/read-loop";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import { ManualClock } from "../bridge/manual-clock";
import { emeraldMemory, TREECKO } from "../support/emerald-memory";
import { ALL_SUPPORTED } from "../support/supported";
import { FakeRetroArch, gbaDescriptors } from "./fake-retroarch";

const { registry } = loadProfiles({ builtin: [emerald], user: [] });

const closers: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function until(condition: () => boolean, ms = 3000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 2));
  }
}

describe("party through the fake RetroArch", () => {
  test("identifies Emerald from the header and serves the party from synthetic memory", async () => {
    const fake = new FakeRetroArch();
    fake.descriptors = gbaDescriptors(emeraldMemory([TREECKO]));
    await fake.start();
    closers.push(() => fake.stop());
    const clock = new ManualClock();
    const adapter = createRetroArchAdapter(
      { host: "127.0.0.1", port: fake.port },
      { clock, log: silentLog },
    );
    closers.push(() => adapter.close());
    adapter.setMode("live");
    const loop = createReadLoop({
      supported: ALL_SUPPORTED,
      adapter,
      registry,
      pollHz: 20,
      clock,
      log: silentLog,
    });
    closers.push(() => loop.close());
    await until(() => loop.status().state === "game");
    const party = await loop.get("party");
    expect(party.ok).toBe(true);
    if (!party.ok) return;
    expect(party.value.pokemon).toMatchObject([
      { species: { id: 277 }, nickname: "LEAFY", level: 5 },
    ]);
    expect(fake.reads.length).toBeGreaterThan(0);
  });
});
