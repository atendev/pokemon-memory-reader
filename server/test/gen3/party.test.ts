import { describe, expect, test } from "bun:test";
import { NATURES, Party } from "@pokemon-memory-reader/api/schemas";
import { Bytes } from "../../src/format/bytes";
import { gen3Party } from "../../src/format/gen3/party";
import { SUBSTRUCT_POSITIONS } from "../../src/format/gen3/structs";
import type { DecodeContext } from "../../src/format/types";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import type { Profile } from "../../src/profile/schema";
import { referenceData } from "../../src/reference";
import {
  encodeMon,
  encodeText,
  type MonSpec,
  POSITIONS,
  partyBytes,
} from "./encode";

const loaded = loadProfiles({ builtin: [emerald], user: [] });
const profile = loaded.registry.get("emerald-us-1.0");
if (profile?.dataFormat !== "gen3") throw new Error("Emerald profile missing");
const reference = referenceData("gen3", "en");
if (!reference) throw new Error("Gen 3 English reference data missing");

const ctx: DecodeContext<Profile<"gen3">> = {
  profile,
  ...reference,
  names: {
    ...reference.names,
    locations: (id) => (id === 9 ? "PETALBURG CITY" : null),
  },
};

const TREECKO = 277;
const TACKLE = 33;
const EMBER = 52;

const decode = (mons: Uint8Array[], count = mons.length) => {
  const result = gen3Party.decode(
    {
      count: new Bytes(Uint8Array.of(count)),
      party: new Bytes(partyBytes(mons)),
    },
    ctx,
  );
  return result;
};
const decodeOne = (spec: MonSpec) => {
  const result = decode([encodeMon(spec)]);
  if (!result.ok) throw new Error(result.reason);
  const [mon] = result.value.pokemon;
  if (!mon) throw new Error("no mon");
  return mon;
};

const treecko: MonSpec = {
  personality: 0x00000108,
  tid: 12345,
  sid: 6789,
  nickname: "LEAFY",
  otName: "BRENDAN",
  species: TREECKO,
  heldItem: 13,
  experience: 135,
  ppBonuses: 0b00_00_01_10,
  friendship: 70,
  moves: [TACKLE, EMBER, 0, 0],
  pp: [35, 25, 0, 0],
  evs: { hp: 1, atk: 2, def: 3, spe: 4, spa: 5, spd: 6 },
  pokerus: 0x32,
  metLocation: 9,
  metLevel: 5,
  metGame: 3,
  ball: 4,
  ivs: { hp: 31, atk: 30, def: 29, spe: 28, spa: 27, spd: 26 },
  abilityNum: 0,
  level: 5,
  hp: 19,
  maxHp: 20,
};

describe("substructure order", () => {
  test("the order table matches pokeemerald for all 24 values", () => {
    expect(
      SUBSTRUCT_POSITIONS.map((p) => [p.growth, p.attacks, p.evs, p.misc]),
    ).toEqual(POSITIONS.map((p) => [...p]));
  });

  test("every order decodes the same mon", () => {
    for (let order = 0; order < 24; order++) {
      const mon = decodeOne({
        ...treecko,
        personality: 0x100 + order - (0x100 % 24) + 24,
      });
      expect(mon.moves.map((m) => m.id)).toEqual([TACKLE, EMBER]);
      expect(mon.ivs.hp).toBe(31);
      expect(mon.evs?.spd).toBe(6);
      expect(mon.species.id).toBe(TREECKO);
    }
  });
});

describe("a known mon round-trips", () => {
  const mon = decodeOne(treecko);

  test("identity", () => {
    expect(mon.species).toEqual({ id: TREECKO, dex: 252, name: "TREECKO" });
    expect(mon.nickname).toBe("LEAFY");
    expect(mon.ot).toEqual({
      name: "BRENDAN",
      id: 12345,
      secretId: 6789,
      gender: "male",
    });
    expect(mon.personality).toBe(0x108);
    expect(mon.language).toBe(2);
    expect(mon.isEgg).toBe(false);
    expect(mon.eggCycles).toBeNull();
  });

  test("stats, IVs and EVs", () => {
    expect(mon.level).toBe(5);
    expect(mon.experience).toBe(135);
    expect(mon.friendship).toBe(70);
    expect(mon.hp).toBe(19);
    expect(mon.maxHp).toBe(20);
    expect(mon.stats).toEqual({
      hp: 20,
      atk: 11,
      def: 12,
      spe: 13,
      spa: 14,
      spd: 15,
    });
    expect(mon.ivs).toEqual({
      hp: 31,
      atk: 30,
      def: 29,
      spe: 28,
      spa: 27,
      spd: 26,
    });
    expect(mon.evs).toEqual({ hp: 1, atk: 2, def: 3, spe: 4, spa: 5, spd: 6 });
  });

  test("derived fields", () => {
    expect(mon.types).toEqual(["grass"]);
    expect(mon.ability).toEqual({ id: 65, name: "OVERGROW" });
    expect(mon.nature).toBe("naive");
    expect(mon.gender).toBe("female");
    expect(mon.shiny).toBe(false);
    expect(mon.status).toBe("none");
    expect(mon.pokerus).toBe("infected");
    expect(mon.heldItem).toEqual({ id: 13, name: "POTION" });
    expect(mon.ball).toEqual({ id: 4, name: "POKé BALL" });
    expect(mon.hiddenPower).toEqual({ type: "bug", power: 62 });
  });

  test("moves carry type, PP and PP Ups", () => {
    expect(mon.moves).toEqual([
      {
        id: TACKLE,
        name: "TACKLE",
        type: "normal",
        pp: 35,
        maxPp: 35 + 7 * 2,
        ppUps: 2,
      },
      {
        id: EMBER,
        name: "EMBER",
        type: "fire",
        pp: 25,
        maxPp: 25 + 5 * 1,
        ppUps: 1,
      },
    ]);
  });

  test("met data", () => {
    expect(mon.met).toEqual({
      location: { id: 9, name: "PETALBURG CITY" },
      level: 5,
      game: "emerald",
      timeOfDay: null,
    });
  });

  test("the party validates against the API schema", () => {
    const result = decode([
      encodeMon(treecko),
      encodeMon({ ...treecko, personality: 0x207 }),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(Party.safeParse(result.value).success).toBe(true);
  });

  test("a party full of null fields still validates", () => {
    const result = decode([
      encodeMon({ ...treecko, isEgg: true, friendship: 20, nickname: "" }),
      encodeMon({ ...treecko, species: 500, moves: [1000, 0, 0, 0] }),
      encodeMon({ ...treecko, metLocation: 0xfd, metGame: 9 }),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const parsed = Party.safeParse(result.value);
      expect(parsed.success).toBe(true);
    }
  });
});

describe("party count and failures", () => {
  test("slots beyond the count are empty and never decoded", () => {
    const garbage = new Uint8Array(100).fill(0xaa);
    const result = gen3Party.decode(
      {
        count: new Bytes(Uint8Array.of(1)),
        party: new Bytes(partyBytes([encodeMon(treecko), garbage])),
      },
      ctx,
    );
    expect(result.ok && result.value.pokemon.length).toBe(1);
  });

  test("an empty party is ok", () => {
    const result = decode([], 0);
    expect(result).toEqual({ ok: true, value: { pokemon: [] } });
  });

  test("a bad checksum fails the whole party", () => {
    const result = decode([
      encodeMon(treecko),
      encodeMon({ ...treecko, checksumOffset: 1 }),
    ]);
    expect(result).toEqual({
      ok: false,
      reason: "party slot 1: checksum mismatch",
    });
  });

  test("a bad egg fails the whole party", () => {
    const result = decode([encodeMon({ ...treecko, flags: 0x03 })]);
    expect(result).toEqual({ ok: false, reason: "party slot 0: bad egg" });
  });

  test("species 0 inside the count fails", () => {
    const result = decode([encodeMon({ ...treecko, species: 0 })]);
    expect(result).toEqual({ ok: false, reason: "party slot 0: species 0" });
  });

  test("a count above six fails", () => {
    expect(decode([], 7).ok).toBe(false);
  });
});

describe("eggs", () => {
  const egg = decodeOne({
    ...treecko,
    isEgg: true,
    friendship: 20,
    nickname: "",
    language: 1,
    otName: "BRENDAN",
  });

  test("report the hatch counter and hide friendship and nickname", () => {
    expect(egg.isEgg).toBe(true);
    expect(egg.eggCycles).toBe(20);
    expect(egg.friendship).toBeNull();
    expect(egg.nickname).toBeNull();
    expect(egg.language).toBe(1);
  });

  test("decode the OT in the game's language, not Japanese", () => {
    expect(egg.ot?.name).toBe("BRENDAN");
  });

  test("decode the OT with kana when the profile language is ja", () => {
    const japanese = {
      ...ctx,
      profile: { ...profile, language: "ja" } as unknown as Profile<"gen3">,
    };
    const result = gen3Party.decode(
      {
        count: new Bytes(Uint8Array.of(1)),
        party: new Bytes(
          partyBytes([
            encodeMon({ ...treecko, isEgg: true, otName: "ア", otSet: "kana" }),
          ]),
        ),
      },
      japanese,
    );
    expect(result.ok && result.value.pokemon[0]?.ot?.name).toBe("ア");
  });

  test("keep the species that will hatch", () => {
    expect(egg.species.name).toBe("TREECKO");
  });
});

describe("shininess", () => {
  const shiny = {
    ...treecko,
    tid: 0x1234,
    sid: 0x5678,
    personality: 0x454e0101,
  };

  test("a mon whose IDs and personality XOR below 8 is shiny", () => {
    expect(decodeOne(shiny).shiny).toBe(true);
  });

  test("a mon whose XOR is 8 or more is not", () => {
    expect(decodeOne({ ...shiny, personality: 0x454e0109 }).shiny).toBe(false);
    expect(decodeOne({ ...shiny, personality: 0x455e0101 }).shiny).toBe(false);
  });

  test("the threshold sits between XOR 7 and XOR 8", () => {
    expect(decodeOne({ ...shiny, personality: 0x454e0105 }).shiny).toBe(true);
    expect(decodeOne({ ...shiny, personality: 0x454e010a }).shiny).toBe(false);
  });
});

describe("field rules", () => {
  test("status bits", () => {
    const status = (raw: number) =>
      decodeOne({ ...treecko, status: raw }).status;
    expect([0, 3, 0x08, 0x10, 0x20, 0x40, 0x80].map(status)).toEqual([
      "none",
      "sleep",
      "poison",
      "burn",
      "freeze",
      "paralysis",
      "toxic",
    ]);
  });

  test("Pokérus byte", () => {
    const pokerus = (raw: number) =>
      decodeOne({ ...treecko, pokerus: raw }).pokerus;
    expect([0x00, 0x32, 0x30].map(pokerus)).toEqual([
      "none",
      "infected",
      "cured",
    ]);
  });

  test("a second ability comes from the ability bit, and falls back to the first when the species has one", () => {
    const celebi = { ...treecko, species: 251 };
    expect(decodeOne({ ...celebi, abilityNum: 1 }).ability?.id).toBe(30);
    expect(
      decodeOne({ ...treecko, species: 387, abilityNum: 1 }).ability?.id,
    ).toBe(12);
  });

  test("the second ability decodes when the species has one", () => {
    expect(
      decodeOne({ ...treecko, species: 386, abilityNum: 0 }).ability?.id,
    ).toBe(35);
    expect(
      decodeOne({ ...treecko, species: 386, abilityNum: 1 }).ability?.id,
    ).toBe(68);
  });

  test("a personality with bit 31 set stays unsigned for the order, nature and gender", () => {
    const mon = decodeOne({ ...treecko, personality: 0xfffffff0 });
    expect(mon.personality).toBe(0xfffffff0);
    expect(mon.moves.map((m) => m.id)).toEqual([TACKLE, EMBER]);
    expect(mon.nature).toBe(NATURES[0xfffffff0 % 25] ?? null);
    expect(mon.gender).toBe("male");
  });

  test("a dual-typed species lists both types", () => {
    expect(decodeOne({ ...treecko, species: 251 }).types).toEqual([
      "psychic",
      "grass",
    ]);
  });

  test("genderless, always-female and always-male ratios", () => {
    expect(decodeOne({ ...treecko, species: 151 }).gender).toBe("genderless");
    expect(decodeOne({ ...treecko, species: 387 }).gender).toBe("female");
    expect(decodeOne({ ...treecko, species: 386 }).gender).toBe("male");
  });

  test("a ball outside 1-12 gives null, as does a held item of 0", () => {
    const mon = decodeOne({ ...treecko, ball: 0, heldItem: 0 });
    expect(mon.ball).toBeNull();
    expect(mon.heldItem).toBeNull();
    expect(decodeOne({ ...treecko, ball: 13 }).ball).toBeNull();
  });

  test("Hidden Power from IVs", () => {
    const iv = (n: number) => ({
      hp: n,
      atk: n,
      def: n,
      spe: n,
      spa: n,
      spd: n,
    });
    expect(decodeOne({ ...treecko, ivs: iv(31) }).hiddenPower).toEqual({
      type: "dark",
      power: 70,
    });
    expect(decodeOne({ ...treecko, ivs: iv(0) }).hiddenPower).toEqual({
      type: "fighting",
      power: 30,
    });
  });

  test("special met locations have no name, and the origin game maps", () => {
    const mon = decodeOne({ ...treecko, metLocation: 0xfd, metGame: 4 });
    expect(mon.met?.location).toEqual({ id: 0xfd, name: null });
    expect(mon.met?.game).toBe("firered");
    expect(decodeOne({ ...treecko, metGame: 9 }).met?.game).toBeNull();
    expect(decodeOne({ ...treecko, metLevel: 0 }).met?.level).toBe(0);
  });

  test("OT gender bit", () => {
    expect(decodeOne({ ...treecko, otFemale: true }).ot?.gender).toBe("female");
  });

  test("a species outside the table decodes with null names and species data", () => {
    const mon = decodeOne({ ...treecko, species: 500 });
    expect(mon.species).toEqual({ id: 500, dex: null, name: null });
    expect(mon.types).toBeNull();
    expect(mon.gender).toBeNull();
    expect(mon.ability).toBeNull();
  });

  test("a move outside move data has null type and max PP", () => {
    const mon = decodeOne({ ...treecko, moves: [1000, 0, 0, 0] });
    expect(mon.moves[0]).toMatchObject({
      id: 1000,
      name: null,
      type: null,
      maxPp: null,
    });
  });

  test("a Japanese mon decodes its nickname with the kana set", () => {
    const mon = decodeOne({
      ...treecko,
      language: 1,
      nickname: "あ",
      otName: "ア",
    });
    expect(mon.nickname).toBe("あ");
    expect(mon.ot?.name).toBe("ア");
  });
});

describe("declared regions", () => {
  test("a full party and its count byte", () => {
    const regions = gen3Party.regions(profile);
    expect(regions.party).toMatchObject({
      kind: "static",
      length: 600,
      at: { domain: "ewram", offset: 0x244ec },
    });
    expect(regions.count).toMatchObject({
      kind: "static",
      length: 1,
      at: { domain: "ewram", offset: 0x244e9 },
    });
  });
});

describe("charmap", () => {
  test("stops at the terminator and maps unmapped bytes to U+FFFD", () => {
    const text = encodeText("AB", 5);
    expect(reference.charmap.decode(new Bytes(text))).toBe("AB");
    expect(
      reference.charmap.decode(new Bytes(Uint8Array.of(0xbb, 0x0a, 0xbc))),
    ).toBe("A�B");
    expect(
      reference.charmap.decode(new Bytes(Uint8Array.of(0xbb, 0xbc, 0xbd)), 2),
    ).toBe("AB");
  });
});
