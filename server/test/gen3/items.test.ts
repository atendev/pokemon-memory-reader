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

/** Item IDs only some games name: pokeemerald adds 375 and 376, and pokeruby stops before the FireRed key items at 349. */
const OAKS_PARCEL = 349;
const MAGMA_EMBLEM = 375;
const OLD_SEA_MAP = 376;

const heldItemName = (artVersion: typeof profile.artVersion, id: number) => {
  const part = bindGame({ ...profile, artVersion }, ALL_SUPPORTED).party;
  if (!part) throw new Error("no party decoder bound");
  const result = part.decode({
    count: new Bytes(Uint8Array.of(1)),
    party: new Bytes(
      partyBytes([
        encodeMon({ personality: 0x108, species: 277, heldItem: id }),
      ]),
    ),
  });
  if (!result.ok) throw new Error(result.reason);
  return result.value.pokemon[0]?.heldItem;
};

describe("Gen 3 item names", () => {
  test("a bound Emerald party names the held item", () => {
    expect(heldItemName("emerald", OLD_SEA_MAP)).toEqual({
      id: OLD_SEA_MAP,
      name: "OLD SEA MAP",
    });
  });

  test("a name that exists in one game doesn't reach another", () => {
    expect(reference.items("emerald")(MAGMA_EMBLEM)).toBe("MAGMA EMBLEM");
    expect(reference.items("emerald")(OLD_SEA_MAP)).toBe("OLD SEA MAP");
    expect(reference.items("firered-leafgreen")(MAGMA_EMBLEM)).toBeNull();
    expect(reference.items("firered-leafgreen")(OLD_SEA_MAP)).toBeNull();
    expect(reference.items("ruby-sapphire")(OAKS_PARCEL)).toBeNull();
    expect(heldItemName("firered-leafgreen", OLD_SEA_MAP)).toEqual({
      id: OLD_SEA_MAP,
      name: null,
    });
  });

  test("each game names the items it has", () => {
    expect(reference.items("firered-leafgreen")(OAKS_PARCEL)).toBe(
      "OAK'S PARCEL",
    );
    expect(reference.items("ruby-sapphire")(OAKS_PARCEL - 1)).toBe("????????");
    for (const version of [
      "ruby-sapphire",
      "emerald",
      "firered-leafgreen",
    ] as const) {
      expect(reference.items(version)(13)).toBe("POTION");
    }
  });

  test("an art version with no Gen 3 table names nothing", () => {
    expect(reference.items("gold")(13)).toBeNull();
  });
});
