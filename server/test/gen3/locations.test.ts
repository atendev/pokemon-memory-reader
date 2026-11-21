import { describe, expect, test } from "bun:test";
import { Bytes } from "../../src/format/bytes";
import { bindGame } from "../../src/format/registry";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import { referenceData } from "../../src/reference";
import { ALL_SUPPORTED } from "../support/supported";
import { encodeMon, partyBytes } from "./encode";

const loaded = loadProfiles({ builtin: [emerald], user: [] });
const profile = loaded.registry.get("emerald-us-1.0");
if (profile?.dataFormat !== "gen3") throw new Error("Emerald profile missing");
const reference = referenceData("gen3", "en");
if (!reference) throw new Error("Gen 3 English reference data missing");

/** Section IDs are list positions in pret's region_map_sections.json (amendment 019 §4). */
const PETALBURG_CITY = 7;
const PALLET_TOWN = 88;

const metLocationName = (artVersion: typeof profile.artVersion, id: number) => {
  const part = bindGame({ ...profile, artVersion }, ALL_SUPPORTED).party;
  if (!part) throw new Error("no party decoder bound");
  const result = part.decode({
    count: new Bytes(Uint8Array.of(1)),
    party: new Bytes(
      partyBytes([
        encodeMon({ personality: 0x108, species: 277, metLocation: id }),
      ]),
    ),
  });
  if (!result.ok) throw new Error(result.reason);
  return result.value.pokemon[0]?.met?.location;
};

describe("Gen 3 location names", () => {
  test("a bound Emerald party names the met location", () => {
    expect(metLocationName("emerald", PETALBURG_CITY)).toEqual({
      id: PETALBURG_CITY,
      name: "PETALBURG CITY",
    });
  });

  test("each art version reads its own table", () => {
    expect(reference.locations("emerald")(PALLET_TOWN)).toBe("PALLET TOWN");
    expect(reference.locations("firered-leafgreen")(PALLET_TOWN)).toBe(
      "PALLET TOWN",
    );
    expect(reference.locations("ruby-sapphire")(PETALBURG_CITY)).toBe(
      "PETALBURG CITY",
    );
    expect(metLocationName("firered-leafgreen", PALLET_TOWN)?.name).toBe(
      "PALLET TOWN",
    );
  });

  test("a section the table doesn't name gives a null name", () => {
    // FireRed lists the Hoenn sections without names; Ruby's list stops before the Kanto sections.
    expect(metLocationName("firered-leafgreen", PETALBURG_CITY)).toEqual({
      id: PETALBURG_CITY,
      name: null,
    });
    expect(reference.locations("ruby-sapphire")(PALLET_TOWN)).toBeNull();
    expect(reference.locations("emerald")(500)).toBeNull();
  });

  test("an art version with no Gen 3 table names nothing", () => {
    expect(reference.locations("gold")(PETALBURG_CITY)).toBeNull();
  });

  test("Ruby's name-end marker is gone and no table keeps a control code", () => {
    expect(reference.locations("ruby-sapphire")(0)).toBe("LITTLEROOT TOWN");
    for (const version of [
      "ruby-sapphire",
      "emerald",
      "firered-leafgreen",
    ] as const) {
      for (let id = 0; id < 256; id++) {
        expect(reference.locations(version)(id) ?? "").not.toMatch(/[{}]/);
      }
    }
  });
});
