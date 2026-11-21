import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { SliceAdapter } from "../../src/adapter/memory";
import {
  buildFixture,
  type FixtureMeta,
  loadFixture,
} from "../../src/fixture/file";
import { assertGolden, loadGolden } from "../../src/fixture/golden";
import { gen3Party } from "../../src/format/gen3/party";
import { region } from "../../src/format/regions";
import { fail, ok, type ResourceDecoder } from "../../src/format/types";
import type { Profile } from "../../src/profile/schema";
import { runFixtureFile, runFixturePart } from "../support/run-fixture";

const DIR = join(import.meta.dir, "synthetic", "emerald-us-1.0");
const FIXTURE = join(DIR, "two-mon-party.fixture.json");

const meta: FixtureMeta = {
  profileId: "emerald-us-1.0",
  dataFormat: "gen3",
  emulator: { name: "synthetic", version: null },
  adapter: "synthetic",
  captureToolVersion: "none",
  captureDate: "2026-11-21T00:00:00.000Z",
  anonymized: true,
  description: "test",
};

describe("SliceAdapter", () => {
  test("serves a fixture to the real party decoder and matches its golden", async () => {
    const decoded = await runFixtureFile(FIXTURE, gen3Party);
    if (!decoded.ok) throw new Error(decoded.reason);
    expect(decoded.value.pokemon.map((mon) => mon.nickname)).toEqual([
      "LEAFY",
      "SPARK",
    ]);
    assertGolden(await loadGolden(join(DIR, "two-mon-party.expected.json")), {
      party: decoded.value,
    });
  });

  test("a changed decoded value fails the golden with a readable diff", async () => {
    const decoded = await runFixtureFile(FIXTURE, gen3Party);
    if (!decoded.ok) throw new Error(decoded.reason);
    const changed = structuredClone(decoded.value);
    const first = changed.pokemon[0];
    if (!first) throw new Error("no mon");
    first.level = 6;
    const golden = await loadGolden(join(DIR, "two-mon-party.expected.json"));
    expect(() => assertGolden(golden, { party: changed })).toThrow(
      /party\.pokemon\[0\]\.level: expected 5, got 6/,
    );
  });

  test("the state shows a connected adapter with no ROM access", async () => {
    const { state, limits } = new SliceAdapter(await loadFixture(FIXTURE));
    expect(state.connection).toBe("connected");
    expect(state.game?.platform).toBe("gba");
    expect(state.game?.domains).toEqual({ ewram: 0x244ec + 600 });
    expect(state.game?.domains.rom).toBeUndefined();
    expect(limits.mergeGap).toBe(0);
  });

  test("reads across two adjacent regions as one range", async () => {
    const adapter = new SliceAdapter(
      buildFixture(meta, [
        { domain: "ewram", offset: 10, bytes: Uint8Array.of(1, 2, 3) },
        { domain: "ewram", offset: 13, bytes: Uint8Array.of(4, 5) },
      ]),
    );
    const out = await adapter.read(
      [{ domain: "ewram", offset: 11, length: 3 }],
      100,
    );
    expect(out).toEqual({ kind: "data", slices: [Uint8Array.of(2, 3, 4)] });
  });

  test("a read outside a recorded region throws", async () => {
    const adapter = new SliceAdapter(
      buildFixture(meta, [
        { domain: "ewram", offset: 10, bytes: Uint8Array.of(1, 2, 3) },
      ]),
    );
    const outside = (
      domain: "ewram" | "iwram" | "rom",
      offset: number,
      length: number,
    ) => adapter.read([{ domain, offset, length }], 100);
    await expect(outside("ewram", 9, 2)).rejects.toThrow(
      /no recorded region covers/,
    );
    await expect(outside("ewram", 12, 2)).rejects.toThrow(/reaches 0xd,/);
    await expect(outside("iwram", 0, 1)).rejects.toThrow(/iwram/);
    await expect(outside("rom", 0, 1)).rejects.toThrow(/rom/);
  });

  test("a gap between two regions is never bridged", async () => {
    const adapter = new SliceAdapter(
      buildFixture(meta, [
        { domain: "ewram", offset: 0, bytes: Uint8Array.of(1) },
        { domain: "ewram", offset: 2, bytes: Uint8Array.of(3) },
      ]),
    );
    await expect(
      adapter.read([{ domain: "ewram", offset: 0, length: 3 }], 100),
    ).rejects.toThrow(/reaches 0x1,/);
  });

  test("a decoder that reads undeclared memory fails loudly", async () => {
    const greedy: ResourceDecoder<
      Profile<"gen3">,
      { readonly all: ReturnType<typeof region> },
      number
    > = {
      regions: (p) => ({ all: region(p.addresses.gPlayerParty, 601) }),
      decode: ({ all }) => (all.length > 0 ? ok(all.length) : fail("empty")),
    };
    await expect(
      runFixturePart(await loadFixture(FIXTURE), greedy),
    ).rejects.toThrow(/no recorded region covers/);
  });
});
