import { describe, expect, test } from "bun:test";
import { z } from "zod";
import emerald from "./builtin/emerald-us-1.0.json";
import { profileFile, profileFull } from "./schema";

const clone = (): Record<string, unknown> =>
  structuredClone(emerald) as Record<string, unknown>;

function messages(raw: unknown): string {
  const parsed = profileFull.safeParse(raw);
  return parsed.success
    ? ""
    : parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
}

describe("the Emerald profile", () => {
  test("passes both schemas and translates addresses", () => {
    expect(profileFile.safeParse(emerald).success).toBe(true);
    const parsed = profileFull.parse(emerald);
    expect(parsed.id).toBe("emerald-us-1.0");
    expect(parsed.addresses.gPlayerParty).toEqual({
      domain: "ewram",
      offset: 0x244ec,
    });
    expect(parsed.addresses.gSaveBlock1).toEqual({
      at: { domain: "iwram", offset: 0x5d8c },
      width: 4,
      bank: null,
      offset: 0,
    });
    expect(parsed.identify?.signature[0]?.address).toEqual({
      domain: "rom",
      offset: 0x1bc,
    });
    expect(parsed.features.boxes).toBe(true);
    expect(parsed.provenance).toEqual({
      kind: "pret",
      repo: "pret/pokeemerald",
      commit: "4a73ce73964859d53a2d21e58db2525e8fa4b31b",
      symbolFile: "pokeemerald.sym",
      signatureEvidence: "unconfirmed",
    });
  });
});

describe("the full schema rejects malformed profiles", () => {
  test("a missing required field", () => {
    for (const key of [
      "id",
      "kind",
      "name",
      "dataFormat",
      "language",
      "artVersion",
      "addresses",
    ]) {
      const raw = clone();
      delete raw[key];
      expect(profileFull.safeParse(raw).success).toBe(false);
    }
  });

  test("a missing address key", () => {
    const raw = clone();
    delete (raw.addresses as Record<string, unknown>).gPlayerParty;
    expect(messages(raw)).toContain("addresses.gPlayerParty");
  });

  test("an address outside every mapped range, naming the field and value", () => {
    const raw = clone();
    (raw.addresses as Record<string, unknown>).gPlayerParty = "0x02040000";
    expect(messages(raw)).toContain(
      'addresses.gPlayerParty: GBA address outside every mapped range: "0x02040000"',
    );
  });

  test("a pointer entry where a static address is required", () => {
    const raw = clone();
    (raw.addresses as Record<string, unknown>).gPlayerParty = {
      ptr: "0x03005d8c",
      offset: "0x0",
    };
    expect(profileFull.safeParse(raw).success).toBe(false);
  });

  test("a bank on a GBA pointer entry", () => {
    const raw = clone();
    (raw.addresses as Record<string, unknown>).gSaveBlock1 = {
      ptr: "0x03005d8c",
      offset: "0x0",
      bank: "01",
    };
    expect(messages(raw)).toContain("bank is not allowed");
  });

  test("an unknown top-level key or address key", () => {
    expect(profileFull.safeParse({ ...clone(), extra: 1 }).success).toBe(false);
    const raw = clone();
    (raw.addresses as Record<string, unknown>).gTypo = "0x02000000";
    expect(profileFull.safeParse(raw).success).toBe(false);
  });

  test("a language without shipped reference data", () => {
    expect(messages({ ...clone(), language: "de" })).toContain(
      'language "de" has no shipped reference data',
    );
    expect(profileFile.safeParse({ ...clone(), language: "de" }).success).toBe(
      true,
    );
  });

  test("malformed hashes, header and signature bytes", () => {
    const bad = (identify: Record<string, unknown>) =>
      profileFull.safeParse({
        ...clone(),
        identify: { ...(emerald.identify as object), ...identify },
      }).success;
    expect(bad({ sha1: ["XYZ"] })).toBe(false);
    expect(bad({ crc32: ["1F1C08FB"] })).toBe(false);
    expect(bad({ header: { gameCode: "BPE", revision: 0 } })).toBe(false);
    expect(bad({ signature: [{ address: "0x080001bc", bytes: "abc" }] })).toBe(
      false,
    );
    expect(
      bad({ signature: [{ address: "0x0a000000", bytes: "aabbccdd" }] }),
    ).toBe(false);
  });

  test("a bad artVersion, kind or fixture", () => {
    expect(
      profileFull.safeParse({ ...clone(), artVersion: "gold-silver" }).success,
    ).toBe(false);
    expect(
      profileFull.safeParse({ ...clone(), kind: "unofficial" }).success,
    ).toBe(false);
    expect(
      profileFull.safeParse({ ...clone(), fixture: "partial" }).success,
    ).toBe(false);
  });

  test("a trainer table with no count", () => {
    const raw = clone();
    (raw.trainerTables as Record<string, unknown>).trainers = {
      base: "0x08310030",
    };
    expect(profileFull.safeParse(raw).success).toBe(false);
  });

  test("a hack must state every name table, species table and move table", () => {
    const hack = {
      ...clone(),
      id: "radical-red-4.1",
      kind: "hack",
      name: "Radical Red 4.1",
      dataFormat: "cfru",
    };
    const text = messages(hack);
    for (const key of ["species", "moves", "items", "abilities", "locations"]) {
      expect(text).toContain(`nameTables.${key}`);
    }
    for (const key of ["info", "dex", "exp"])
      expect(text).toContain(`speciesData.${key}`);
    expect(text).toContain("moveData");
    const complete = {
      ...hack,
      nameTables: {
        species: "vanilla",
        moves: "vanilla",
        items: "vanilla",
        abilities: "vanilla",
        locations: "vanilla",
      },
      speciesData: { info: "vanilla", dex: "vanilla", exp: "vanilla" },
      moveData: "vanilla",
    };
    const parsed = profileFull.parse(complete);
    expect(parsed.features.boxes).toBe(false);
  });

  test("hack tables take base, count, stride and an inline name", () => {
    const hack = {
      ...clone(),
      id: "x-hack",
      kind: "hack",
      name: "X",
      dataFormat: "cfru",
      nameTables: {
        species: {
          base: { ptr: "0x08000144", offset: "0x0" },
          count: 1000,
          stride: 11,
          name: { kind: "inline", length: 11 },
        },
        moves: "vanilla",
        items: "vanilla",
        abilities: "vanilla",
        locations: "vanilla",
      },
      speciesData: {
        info: { base: "0x08254784", count: 1000 },
        dex: "vanilla",
        exp: { base: "0x08250000", maxLevel: 100 },
      },
      moveData: { base: "0x08250000", count: 700 },
    };
    const parsed = profileFull.parse(hack);
    expect(parsed.nameTables?.species).toMatchObject({
      nameOffset: 0,
      count: 1000,
    });
    const bad = structuredClone(hack);
    bad.nameTables.species.name = { kind: "pointer", maxLength: 8 } as never;
    expect(profileFull.safeParse(bad).success).toBe(false);
  });
});

describe("the Gen 3 player block", () => {
  test("the Emerald profile types its player values", () => {
    const parsed = profileFull.parse(emerald);
    expect(parsed.dataFormat === "gen3" && parsed.player).toEqual({
      badgeFlags: [0x867, 0x868, 0x869, 0x86a, 0x86b, 0x86c, 0x86d, 0x86e],
      moneyOffset: 0x490,
      flagsOffset: 0x1270,
      encryptionKeyOffset: 0xac,
    });
  });

  test("a Gen 3 profile without eight badge flags, or without a player block, fails", () => {
    const short = clone();
    short.player = { ...(short.player as object), badgeFlags: [1, 2, 3] };
    expect(messages(short)).toContain("player.badgeFlags");
    const missing = clone();
    delete missing.player;
    expect(messages(missing)).toContain("player");
  });

  test("a file may state a null key to drop an inherited one", () => {
    expect(
      profileFile.safeParse({
        id: "a",
        kind: "hack",
        name: "x",
        extends: "b",
        player: { encryptionKeyOffset: null },
      }).success,
    ).toBe(true);
  });
});

describe("the file schema", () => {
  test("exports JSON Schema", () => {
    const schema = z.toJSONSchema(profileFile) as {
      properties?: Record<string, unknown>;
    };
    expect(Object.keys(schema.properties ?? {})).toEqual(
      expect.arrayContaining([
        "id",
        "kind",
        "name",
        "extends",
        "addresses",
        "nameTables",
        "fixture",
      ]),
    );
  });

  test("needs id, kind and name, and rejects unknown keys", () => {
    expect(profileFile.safeParse({ kind: "official", name: "x" }).success).toBe(
      false,
    );
    expect(profileFile.safeParse({ id: "a", name: "x" }).success).toBe(false);
    expect(profileFile.safeParse({ id: "a", kind: "official" }).success).toBe(
      false,
    );
    expect(
      profileFile.safeParse({
        id: "a",
        kind: "official",
        name: "x",
        surprise: 1,
      }).success,
    ).toBe(false);
    expect(
      profileFile.safeParse({
        id: "a",
        kind: "official",
        name: "x",
        extends: "b",
      }).success,
    ).toBe(true);
  });
});
