import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  Adapter,
  AdapterState,
  GameInfo,
  Range,
  ReadOutcome,
} from "../../src/adapter/types";
import { openPickStore, type PickStore } from "../../src/identify/pick-store";
import { silentLog } from "../../src/log";
import { createReadLoop } from "../../src/loop/read-loop";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import { ManualClock } from "../bridge/manual-clock";
import { emeraldMemory, serve, TREECKO } from "../support/emerald-memory";

const { registry } = loadProfiles({ builtin: [emerald], user: [] });

const game = (over: Partial<GameInfo> = {}): GameInfo => ({
  platform: "gba",
  crc32: "deadbeef",
  sha1: null,
  romName: "Hack",
  domains: { rom: 0x400, ewram: 0x40000, iwram: 0x8000 },
  ...over,
});

const connected = (current: GameInfo | null, epoch = 1): AdapterState => ({
  connection: "connected",
  bridge: null,
  problem: null,
  game: current,
  gameEpoch: epoch,
});

class Rom implements Adapter {
  readonly id = "mgba";
  readonly limits = { minIntervalMs: 0, mergeGap: 32 };
  memory = emeraldMemory([TREECKO]);
  state: AdapterState;
  #listeners = new Set<(state: AdapterState) => void>();

  constructor(first: GameInfo | null) {
    this.state = connected(first);
  }

  subscribe(listener: (state: AdapterState) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  load(next: GameInfo | null): void {
    this.state = connected(next, this.state.gameEpoch + 1);
    for (const listener of this.#listeners) listener(this.state);
  }

  async read(ranges: readonly Range[]): Promise<ReadOutcome> {
    return {
      kind: "data",
      slices: ranges.map((range) => serve(this.memory, [range])),
    };
  }
}

const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};

let folder: string;
let file: string;
const open: { close(): Promise<void> }[] = [];

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "loop-picks-"));
  file = join(folder, "manual-picks.json");
});
afterEach(async () => {
  for (const loop of open.splice(0)) await loop.close();
  await rm(folder, { recursive: true, force: true });
});

async function setup(first: GameInfo | null, picks?: PickStore, revision = 0) {
  const adapter = new Rom(first);
  adapter.memory.rom[0xbc] = revision;
  const store = picks ?? (await openPickStore(file, silentLog));
  const loop = createReadLoop({
    adapter,
    registry,
    pollHz: 20,
    clock: new ManualClock(),
    log: silentLog,
    picks: store,
  });
  open.push(loop);
  await flush();
  return { adapter, loop, store };
}

const pickEmerald = { profileId: "emerald-us-1.0", scope: "rom" } as const;

describe("manual picks through the loop", () => {
  test("a ROM nothing matches is unidentified until it is picked, then shows the pick in status", async () => {
    const { loop } = await setup(game());
    expect(loop.status().state).toBe("unidentified");
    const result = await loop.pick(pickEmerald);
    expect(result).toEqual({
      ok: true,
      value: {
        key: "crc32:deadbeef",
        scope: "rom",
        profileId: "emerald-us-1.0",
        saved: true,
        reason: null,
      },
    });
    const status = loop.status();
    expect(status.state).toBe("game");
    expect(status.game).toMatchObject({
      profileId: "emerald-us-1.0",
      match: "manual",
    });
  });

  test("the pick is written to the data folder", async () => {
    const { loop } = await setup(game());
    await loop.pick(pickEmerald);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({
      version: 1,
      picks: { "crc32:deadbeef": { profileId: "emerald-us-1.0" } },
    });
  });

  test("a pick survives a restart: a new loop identifies the same ROM as picked", async () => {
    const first = await setup(game());
    await first.loop.pick(pickEmerald);
    await first.loop.close();
    open.length = 0;
    const second = await setup(game());
    expect(second.loop.status().game).toMatchObject({ match: "manual" });
  });

  test("forgetting a pick lands back on unidentified, and the next load stays unidentified", async () => {
    const { loop, adapter } = await setup(game());
    await loop.pick(pickEmerald);
    expect(await loop.forget()).toEqual({ ok: true });
    expect(loop.status().state).toBe("unidentified");
    adapter.load(game());
    await flush();
    expect(loop.status().state).toBe("unidentified");
  });

  test("a base pick covers any modified ROM of that base game", async () => {
    const { loop, adapter } = await setup(game());
    const result = await loop.pick({
      profileId: "emerald-us-1.0",
      scope: "base",
    });
    expect(result).toMatchObject({
      ok: true,
      value: { key: "base:emerald-us-1.0", scope: "base", saved: true },
    });
    adapter.load(game({ crc32: "cafef00d" }));
    await flush();
    expect(loop.status().game).toMatchObject({ match: "manual" });
  });

  test("a pick with no key lasts for the session only and says so", async () => {
    const { loop, adapter } = await setup(
      game({ crc32: null, domains: {}, contentName: null }),
    );
    expect(loop.status().state).toBe("unidentified");
    const result = await loop.pick(pickEmerald);
    expect(result).toMatchObject({
      ok: true,
      value: { key: null, saved: false, reason: "no_key" },
    });
    expect(loop.status().game).toMatchObject({ match: "manual" });
    adapter.load(game({ crc32: null, domains: {}, contentName: null }));
    await flush();
    expect(loop.status().state).toBe("unidentified");
  });

  test("a pick the file refuses still applies and reports write_failed", async () => {
    const refusing: PickStore = {
      lookup: () => null,
      save: () => Promise.resolve(false),
      forget: () => Promise.resolve(false),
    };
    const { loop } = await setup(game(), refusing);
    const result = await loop.pick(pickEmerald);
    expect(result).toMatchObject({
      ok: true,
      value: { key: "crc32:deadbeef", saved: false, reason: "write_failed" },
    });
    expect(loop.status().game).toMatchObject({ match: "manual" });
  });

  test("changing a pick replaces the old entry", async () => {
    const { loop, store } = await setup(game());
    await loop.pick(pickEmerald);
    await loop.pick({ profileId: "emerald-us-1.0", scope: "base" });
    expect(store.lookup(["crc32:deadbeef"])).toBeNull();
    expect(store.lookup(["base:emerald-us-1.0"])).not.toBeNull();
  });

  describe("refusals", () => {
    test("no ROM is no_rom, for a pick and a forget", async () => {
      const { loop } = await setup(null);
      expect(await loop.pick(pickEmerald)).toMatchObject({
        ok: false,
        code: "no_rom",
      });
      expect(await loop.forget()).toMatchObject({
        ok: false,
        code: "no_rom",
      });
    });

    test("another platform is no_rom", async () => {
      const { loop } = await setup(game({ platform: "other" }));
      expect(await loop.pick(pickEmerald)).toMatchObject({ code: "no_rom" });
    });

    test("a ROM an exact match already identified is pick_not_allowed", async () => {
      const { loop } = await setup(game({ crc32: "1f1c08fb" }));
      expect(await loop.pick(pickEmerald)).toMatchObject({
        ok: false,
        code: "pick_not_allowed",
      });
    });

    test("a profile that isn't loaded, or is for another platform, is unknown_profile", async () => {
      const { loop } = await setup(game());
      expect(
        await loop.pick({ profileId: "nope", scope: "rom" }),
      ).toMatchObject({ ok: false, code: "unknown_profile" });
      const gb = await setup(game({ platform: "gb" }));
      expect(await gb.loop.pick(pickEmerald)).toMatchObject({
        code: "unknown_profile",
      });
    });

    test("a base pick with no hash is base_pick_not_allowed", async () => {
      const { loop } = await setup(game({ crc32: null }), undefined, 7);
      expect(
        await loop.pick({ profileId: "emerald-us-1.0", scope: "base" }),
      ).toMatchObject({ ok: false, code: "base_pick_not_allowed" });
    });

    test("forgetting with no pick is forget_not_allowed", async () => {
      const { loop } = await setup(game());
      expect(await loop.forget()).toMatchObject({
        ok: false,
        code: "forget_not_allowed",
      });
    });
  });
});
