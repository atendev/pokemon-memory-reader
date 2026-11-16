import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { heldBack } from "./definitions";
import { parseLedger } from "./evidence";
import { releaseGateProblems, type ShippedProfile } from "./gate";
import { NOTES_FILE } from "./plan";

/** The release gate runs in CI with no ROMs, because only the owner's machine runs `test:local`. */
const BUILTIN = join(import.meta.dir, "../../server/src/profile/builtin");
const shipped: ShippedProfile[] = readdirSync(BUILTIN)
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => JSON.parse(readFileSync(join(BUILTIN, file), "utf8")));
const ledger = parseLedger(
  readFileSync(join(import.meta.dir, "signature-ledger.json"), "utf8"),
);
const heldIds = heldBack.map((h) => h.id);
const notes = readFileSync(join(BUILTIN, NOTES_FILE), "utf8");

test("the built-in profiles pass the release gate", () => {
  expect(shipped.length).toBeGreaterThan(0);
  expect(releaseGateProblems(shipped, ledger, heldIds, notes)).toEqual([]);
});

describe("the gate fails when", () => {
  const [emerald] = shipped;
  if (!emerald) throw new Error("no built-in profile");
  const without = (profile: ShippedProfile): ShippedProfile => ({
    ...profile,
    provenance: { kind: "pret", repo: profile.provenance?.repo ?? "" },
  });

  test("a shipped profile lacks a rating", () => {
    expect(
      releaseGateProblems([without(emerald)], ledger, heldIds, notes),
    ).toEqual([`${emerald.id} has no signatureEvidence rating`]);
  });

  test("a rating disagrees with the ledger", () => {
    const sha1 = emerald.identify?.sha1[0] ?? "";
    const owned = [{ profileId: emerald.id, sha1, date: "2026-11-16" }];
    expect(releaseGateProblems([emerald], owned, heldIds, notes)).toEqual([
      `${emerald.id} is rated unconfirmed, but the ledger and SHA-1 data give owner`,
    ]);
  });

  test("a ledger entry names a SHA-1 the profile doesn't list", () => {
    const stale = [
      { profileId: emerald.id, sha1: "0".repeat(40), date: "2026-11-16" },
    ];
    expect(releaseGateProblems([emerald], stale, heldIds, notes)).toHaveLength(
      1,
    );
  });

  test("a held-back revision is in the built-in set", () => {
    expect(
      releaseGateProblems([emerald], ledger, [...heldIds, emerald.id], notes),
    ).toEqual([`${emerald.id} is held back but is in the built-in set`]);
  });

  test("a profile has no CRC32 beside its SHA-1", () => {
    const broken: ShippedProfile = {
      ...emerald,
      identify: {
        sha1: emerald.identify?.sha1 ?? [],
        crc32: [],
        signature: emerald.identify?.signature ?? [],
      },
    };
    expect(releaseGateProblems([broken], ledger, heldIds, notes)).toEqual([
      `${emerald.id} has a SHA-1 with no No-Intro CRC32: a broken chain`,
    ]);
  });

  test("the release notes leave out a profile that isn't owner", () => {
    expect(releaseGateProblems([emerald], ledger, heldIds, "nothing")).toEqual([
      `the release notes leave out ${emerald.id} (unconfirmed)`,
    ]);
  });

  test("an official profile without signature words has no CRC32 beside its SHA-1", () => {
    const unsigned: ShippedProfile = {
      ...emerald,
      identify: { sha1: emerald.identify?.sha1 ?? [], crc32: [] },
    };
    expect(releaseGateProblems([unsigned], ledger, heldIds, notes)).toEqual([
      `${emerald.id} has a SHA-1 with no No-Intro CRC32: a broken chain`,
    ]);
  });
});
