import {
  NATURES,
  type Pokemon,
  type Stats,
  TYPES,
  type Type,
} from "@pokemon-memory-reader/api/schemas";
import { Bytes } from "../bytes";
import { type DecodeContext, fail, ok, type Result } from "../types";
import { levelFromExperience } from "./growth";
import {
  ATTACKS,
  EVS,
  FLAG,
  GROWTH,
  MISC,
  PARTY_MON,
  readSecure,
} from "./structs";

/** Gen 3 type IDs, in pret order. MYSTERY (0x09) is `mystery`. */
const TYPE_BY_ID: readonly Type[] = TYPES.slice(0, 18);

const GAMES = {
  1: "sapphire",
  2: "ruby",
  3: "emerald",
  4: "firered",
  5: "leafgreen",
  15: "gamecube",
} as const;

const JAPANESE = 1;
/** First met-location values that are not map sections (egg gifts, in-game trades, fateful encounters). */
const FIRST_SPECIAL_LOCATION = 0xfd;
const SHINY_THRESHOLD = 8;
const GENDERLESS = 255;
const ALWAYS_FEMALE = 254;
/** Hidden Power never yields normal or mystery. */
const HIDDEN_POWER_TYPES: readonly Type[] = [
  "fighting",
  "flying",
  "poison",
  "ground",
  "rock",
  "bug",
  "ghost",
  "steel",
  "fire",
  "water",
  "grass",
  "electric",
  "psychic",
  "ice",
  "dragon",
  "dark",
];

export const typeOf = (id: number): Type | null => TYPE_BY_ID[id] ?? null;

/** The species' types with a repeated type collapsed. null when a stored ID isn't in the type table. */
export function speciesTypes(ids: readonly number[]): Type[] | null {
  const types = [...new Set(ids)].map(typeOf);
  return types.every((type) => type !== null) ? types : null;
}

export const ref = (id: number, name: string | null) => ({ id, name });

/** Packs one bit of each IV, in Hidden Power's order: hp, atk, def, spe, spa, spd. */
const ivBits = (ivs: Stats, bit: number): number =>
  [ivs.hp, ivs.atk, ivs.def, ivs.spe, ivs.spa, ivs.spd].reduce(
    (sum, iv, i) => sum + (Bytes.bits(iv, bit, 1) << i),
    0,
  );

function hiddenPower(ivs: Stats): Pokemon["hiddenPower"] {
  const type = HIDDEN_POWER_TYPES[Math.floor((ivBits(ivs, 0) * 15) / 63)];
  if (!type) return null;
  return { type, power: Math.floor((ivBits(ivs, 1) * 40) / 63) + 30 };
}

export function status(raw: number): Pokemon["status"] {
  if (raw & 0x80) return "toxic";
  if (raw & 0x07) return "sleep";
  if (raw & 0x08) return "poison";
  if (raw & 0x10) return "burn";
  if (raw & 0x20) return "freeze";
  if (raw & 0x40) return "paralysis";
  return "none";
}

function pokerus(raw: number): Pokemon["pokerus"] {
  if (raw === 0) return "none";
  return (raw & 0x0f) > 0 ? "infected" : "cured";
}

function gender(genderRatio: number, personality: number): Pokemon["gender"] {
  if (genderRatio === GENDERLESS) return "genderless";
  if (genderRatio === ALWAYS_FEMALE) return "female";
  if (genderRatio === 0) return "male";
  return (personality & 0xff) < genderRatio ? "female" : "male";
}

/**
 * Decodes the 80 bytes every Pokémon stores, which is a whole boxed Pokémon. Fails on a bad egg or
 * a checksum mismatch. Species 0 is an empty slot, which gives null. The fields only a party
 * Pokémon stores (`hp`, `maxHp`, `stats`, `status`) are null, and `level` is computed from
 * experience and the growth rate.
 */
export function decodeBoxMon(
  mon: Bytes,
  ctx: DecodeContext<{ readonly language: string }>,
): Result<Pokemon | null> {
  const flags = mon.u8(PARTY_MON.flags);
  if (Bytes.bits(flags, FLAG.badEgg, 1)) return fail("bad egg");
  const secure = readSecure(mon);
  if (!secure.checksumOk) return fail("checksum mismatch");

  const speciesId = secure.growth.u16le(GROWTH.species);
  if (speciesId === 0) return ok(null);
  const personality = mon.u32le(PARTY_MON.personality);
  const otId = mon.u32le(PARTY_MON.otId);
  const trainerId = otId & 0xffff;
  const secretId = otId >>> 16;

  const ivWord = secure.misc.u32le(MISC.ivs);
  const iv = (shift: number) => Bytes.bits(ivWord, shift, 5);
  const ivs: Stats = {
    hp: iv(0),
    atk: iv(5),
    def: iv(10),
    spe: iv(15),
    spa: iv(20),
    spd: iv(25),
  };
  const isEgg = Bytes.bits(ivWord, 30, 1) === 1;
  const abilityNum = Bytes.bits(ivWord, 31, 1);

  const language = mon.u8(PARTY_MON.language);
  const origins = secure.misc.u16le(MISC.origins);
  const info = ctx.speciesData.info(speciesId);

  const nickSet = language === JAPANESE ? "kana" : "latin";
  const otSet = isEgg
    ? ctx.profile.language === "ja"
      ? "kana"
      : "latin"
    : nickSet;

  const friendshipByte = secure.growth.u8(GROWTH.friendship);
  const ppBonuses = secure.growth.u8(GROWTH.ppBonuses);

  const moves: Pokemon["moves"] = [];
  for (let slot = 0; slot < 4; slot++) {
    const id = secure.attacks.u16le(ATTACKS.moves + slot * 2);
    if (id === 0) continue;
    const ppUps = Bytes.bits(ppBonuses, slot * 2, 2);
    const data = ctx.moveData.move(id);
    moves.push({
      id,
      name: ctx.names.moves(id),
      type: data ? typeOf(data.typeId) : null,
      pp: secure.attacks.u8(ATTACKS.pp + slot),
      maxPp: data ? data.basePp + Math.floor(data.basePp / 5) * ppUps : null,
      ppUps,
    });
  }

  const abilityId = info
    ? abilityNum && info.abilities[1] !== 0
      ? info.abilities[1]
      : info.abilities[0]
    : 0;
  const heldItemId = secure.growth.u16le(GROWTH.heldItem);
  const ballId = Bytes.bits(origins, 11, 4);
  const metLocation = secure.misc.u8(MISC.metLocation);
  const experience = secure.growth.u32le(GROWTH.experience);
  const evs = {
    hp: secure.evs.u8(EVS.hp),
    atk: secure.evs.u8(EVS.atk),
    def: secure.evs.u8(EVS.def),
    spa: secure.evs.u8(EVS.spa),
    spd: secure.evs.u8(EVS.spd),
    spe: secure.evs.u8(EVS.spe),
  };

  return ok({
    species: {
      id: speciesId,
      dex: ctx.speciesData.dex(speciesId),
      name: ctx.names.species(speciesId),
    },
    nickname: isEgg
      ? null
      : ctx.charmap.decode(
          mon.sub(PARTY_MON.nickname, PARTY_MON.nicknameLength),
          PARTY_MON.nicknameLength,
          nickSet,
        ),
    ot: {
      name: ctx.charmap.decode(
        mon.sub(PARTY_MON.otName, PARTY_MON.otNameLength),
        PARTY_MON.otNameLength,
        otSet,
      ),
      id: trainerId,
      secretId,
      gender: Bytes.bits(origins, 15, 1) ? "female" : "male",
    },
    isEgg,
    eggCycles: isEgg ? friendshipByte : null,
    level: info ? levelFromExperience(info.growthRate, experience) : null,
    experience,
    friendship: isEgg ? null : friendshipByte,
    types: info ? speciesTypes(info.types) : null,
    hp: null,
    maxHp: null,
    stats: null,
    ivs,
    evs,
    status: null,
    ability:
      abilityId === 0 ? null : ref(abilityId, ctx.names.abilities(abilityId)),
    heldItem:
      heldItemId === 0 ? null : ref(heldItemId, ctx.names.items(heldItemId)),
    nature: NATURES[personality % 25] ?? null,
    ball:
      ballId >= 1 && ballId <= 12 ? ref(ballId, ctx.names.items(ballId)) : null,
    pokerus: pokerus(secure.misc.u8(MISC.pokerus)),
    moves,
    met: {
      location: ref(
        metLocation,
        metLocation < FIRST_SPECIAL_LOCATION
          ? ctx.names.locations(metLocation)
          : null,
      ),
      level: Bytes.bits(origins, 0, 7),
      game: GAMES[Bytes.bits(origins, 7, 4) as keyof typeof GAMES] ?? null,
      timeOfDay: null,
    },
    personality,
    language,
    shiny:
      (trainerId ^ secretId ^ (personality >>> 16) ^ (personality & 0xffff)) >>>
        0 <
      SHINY_THRESHOLD,
    gender: info ? gender(info.genderRatio, personality) : null,
    hiddenPower: hiddenPower(ivs),
  });
}

/**
 * Decodes one 100-byte party Pokémon. Fails on a checksum mismatch, a bad egg or a missing
 * species. Boxed Pokémon share everything but the trailing party block.
 */
export function decodePartyMon(
  mon: Bytes,
  ctx: DecodeContext<{ readonly language: string }>,
): Result<Pokemon> {
  const stored = decodeBoxMon(mon, ctx);
  if (!stored.ok) return stored;
  if (stored.value === null) return fail("species 0");
  const maxHp = mon.u16le(PARTY_MON.maxHp);
  return ok({
    ...stored.value,
    level: mon.u8(PARTY_MON.level),
    hp: mon.u16le(PARTY_MON.hp),
    maxHp,
    stats: {
      hp: maxHp,
      atk: mon.u16le(PARTY_MON.atk),
      def: mon.u16le(PARTY_MON.def),
      spa: mon.u16le(PARTY_MON.spa),
      spd: mon.u16le(PARTY_MON.spd),
      spe: mon.u16le(PARTY_MON.spe),
    },
    status: status(mon.u32le(PARTY_MON.status)),
  });
}
