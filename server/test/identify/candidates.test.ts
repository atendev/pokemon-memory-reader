import { expect, test } from "bun:test";
import type { GameInfo, Range, ReadOutcome } from "../../src/adapter/types";
import { candidateRows, readSignatures } from "../../src/identify/candidates";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import type { Profile } from "../../src/profile/schema";

const { registry } = loadProfiles({ builtin: [emerald], user: [] });
const base = registry.all()[0] as Profile;

/** A copy of Emerald under a new id and name, with its own hash so the loader accepts both. */
const variant = (id: string, name: string, signature = true): Profile =>
  ({
    ...base,
    id,
    name,
    identify: base.identify && {
      ...base.identify,
      signature: signature ? base.identify.signature : [],
    },
  }) as Profile;

const game: GameInfo = {
  platform: "gba",
  crc32: "deadbeef",
  sha1: null,
  romName: "Hack",
  domains: { rom: 0x400 },
};

/** The right bytes for each signature word of the profile, found by their ROM offset. */
const words = new Map(
  (base.identify?.signature ?? []).flatMap((entry) =>
    "domain" in entry.address
      ? [[entry.address.offset, Buffer.from(entry.bytes, "hex")] as const]
      : [],
  ),
);

const reply = (ranges: readonly Range[]): ReadOutcome => ({
  kind: "data",
  slices: ranges.map((range) => Uint8Array.from(words.get(range.offset) ?? [])),
});

test("candidates sort header matches first, then by name, then id", () => {
  const profiles = [
    variant("c", "Zed"),
    variant("b", "Alpha"),
    variant("a", "Alpha"),
    base,
  ];
  const stub = {
    byHeader: () => [base],
  } as unknown as Parameters<typeof candidateRows>[3];
  const rows = candidateRows(
    profiles,
    game,
    base.identify?.header as never,
    stub,
    new Map(),
  );
  expect(rows.map((row) => row.id)).toEqual([base.id, "a", "b", "c"]);
  expect(rows.map((row) => row.headerMatch)).toEqual([
    true,
    false,
    false,
    false,
  ]);
});

test("a profile with no declared signature gets null, and no header means no base pick", () => {
  const plain = variant("plain", "Plain", false);
  const [row] = candidateRows(
    [plain],
    game,
    null,
    { byHeader: () => [] } as never,
    new Map([["plain", null]]),
  );
  expect(row).toMatchObject({
    signature: null,
    headerMatch: false,
    baseEligible: false,
  });
});

test("signature reads are cut into small requests and each profile gets its own result", async () => {
  const profiles = Array.from({ length: 150 }, (_, i) =>
    variant(`p${i}`, `P${i}`),
  );
  const sizes: number[] = [];
  const { results, complete } = await readSignatures(
    profiles,
    game,
    async (ranges) => {
      sizes.push(ranges.length);
      return reply(ranges);
    },
  );
  expect(complete).toBe(true);
  expect(Math.max(...sizes)).toBeLessThanOrEqual(64);
  expect(sizes.length).toBeGreaterThan(1);
  expect(results.size).toBe(150);
  expect([...results.values()].every((r) => r === "match")).toBe(true);
});

test("a profile with no signature costs no read, and a failed request marks the result incomplete", async () => {
  let reads = 0;
  const none = await readSignatures(
    [variant("n", "N", false)],
    game,
    async (r) => {
      reads += 1;
      return reply(r);
    },
  );
  expect(reads).toBe(0);
  expect(none.results.get("n")).toBeNull();
  const failed = await readSignatures([variant("a", "A")], game, async () => ({
    kind: "timeout",
  }));
  expect(failed.complete).toBe(false);
  expect(failed.results.get("a")).toBe("unchecked");
});

test("an adapter with no ROM domain reads nothing and reports unchecked", async () => {
  let reads = 0;
  const { results, complete } = await readSignatures(
    [variant("a", "A")],
    { domains: {} },
    async (r) => {
      reads += 1;
      return reply(r);
    },
  );
  expect(reads).toBe(0);
  expect(complete).toBe(true);
  expect(results.get("a")).toBe("unchecked");
});
