import { Bytes } from "../bytes";

/** Layout of a Gen 3 party Pokémon, from pokeemerald `struct Pokemon` (100 bytes). */
export const PARTY_MON = {
  size: 100,
  personality: 0x00,
  otId: 0x04,
  nickname: 0x08,
  nicknameLength: 10,
  language: 0x12,
  flags: 0x13,
  otName: 0x14,
  otNameLength: 7,
  checksum: 0x1c,
  secure: 0x20,
  secureSize: 48,
  status: 0x50,
  level: 0x54,
  hp: 0x56,
  maxHp: 0x58,
  atk: 0x5a,
  def: 0x5c,
  spe: 0x5e,
  spa: 0x60,
  spd: 0x62,
} as const;

/**
 * A boxed Pokémon is the first 80 bytes of a party Pokémon (`struct BoxPokemon`). The party block
 * after it holds the status, level and stats the box doesn't store.
 */
export const BOX_MON_SIZE = 80;

/** Layout of `struct PokemonStorage` (pokeemerald), one contiguous block with `currentBox` first. */
export const STORAGE = {
  boxCount: 14,
  slotCount: 30,
  currentBox: 0x00,
  /** `BoxPokemon` is 4-byte aligned, so the boxes start at 4. */
  boxes: 0x04,
  nameLength: 8,
  /** Names are 8 characters and a terminator. */
  nameStride: 9,
  names: 0x04 + 14 * 30 * BOX_MON_SIZE,
  wallpapers: 0x04 + 14 * 30 * BOX_MON_SIZE + 14 * 9,
  size: 0x04 + 14 * 30 * BOX_MON_SIZE + 14 * 9 + 14,
} as const;

/** Bits of the flags byte at +0x13. */
export const FLAG = { badEgg: 0, hasSpecies: 1 } as const;

export const PARTY_MAX = 6;

/** The four 12-byte substructures. Each sits at a position the personality value picks. */
export const SUBSTRUCT = { growth: 0, attacks: 1, evs: 2, misc: 3 } as const;
export type SubstructKind = keyof typeof SUBSTRUCT;
const SUBSTRUCT_SIZE = 12;

/** The 24 substructure orders, indexed by `personality % 24`. G growth, A attacks, E EVs, M misc. */
const ORDERS = [
  "GAEM",
  "GAME",
  "GEAM",
  "GEMA",
  "GMAE",
  "GMEA",
  "AGEM",
  "AGME",
  "AEGM",
  "AEMG",
  "AMGE",
  "AMEG",
  "EGAM",
  "EGMA",
  "EAGM",
  "EAMG",
  "EMGA",
  "EMAG",
  "MGAE",
  "MGEA",
  "MAGE",
  "MAEG",
  "MEGA",
  "MEAG",
] as const;

const LETTER: Record<string, SubstructKind> = {
  G: "growth",
  A: "attacks",
  E: "evs",
  M: "misc",
};

/** For each order, the position of each substructure kind. */
export const SUBSTRUCT_POSITIONS: ReadonlyArray<Record<SubstructKind, number>> =
  ORDERS.map((order) => {
    const positions = {} as Record<SubstructKind, number>;
    [...order].forEach((letter, position) => {
      positions[LETTER[letter] as SubstructKind] = position;
    });
    return positions;
  });

export interface SecureData {
  readonly checksumOk: boolean;
  readonly growth: Bytes;
  readonly attacks: Bytes;
  readonly evs: Bytes;
  readonly misc: Bytes;
}

/**
 * Decrypts the 48 secure bytes with the key `otId ^ personality`, checks the stored checksum (the
 * u16 sum of the 24 decrypted words) and splits the result into its four substructures.
 */
export function readSecure(mon: Bytes): SecureData {
  const personality = mon.u32le(PARTY_MON.personality);
  const otId = mon.u32le(PARTY_MON.otId);
  const key = (otId ^ personality) >>> 0;
  const plain = new Uint8Array(PARTY_MON.secureSize);
  const view = new DataView(plain.buffer);
  let sum = 0;
  for (let i = 0; i < PARTY_MON.secureSize; i += 4) {
    const word = (mon.u32le(PARTY_MON.secure + i) ^ key) >>> 0;
    view.setUint32(i, word, true);
    sum += (word & 0xffff) + (word >>> 16);
  }
  const secure = new Bytes(plain);
  const positions = SUBSTRUCT_POSITIONS[personality % 24] as Record<
    SubstructKind,
    number
  >;
  const part = (kind: SubstructKind) =>
    secure.sub(positions[kind] * SUBSTRUCT_SIZE, SUBSTRUCT_SIZE);
  return {
    checksumOk: (sum & 0xffff) === mon.u16le(PARTY_MON.checksum),
    growth: part("growth"),
    attacks: part("attacks"),
    evs: part("evs"),
    misc: part("misc"),
  };
}

/** Substructure field offsets. */
export const GROWTH = {
  species: 0,
  heldItem: 2,
  experience: 4,
  ppBonuses: 8,
  friendship: 9,
} as const;
export const ATTACKS = { moves: 0, pp: 8 } as const;
export const EVS = { hp: 0, atk: 1, def: 2, spe: 3, spa: 4, spd: 5 } as const;
export const MISC = { pokerus: 0, metLocation: 1, origins: 2, ivs: 4 } as const;

/**
 * The player fields in `struct SaveBlock2` (identity and play time, from offset 0), `struct
 * SaveBlock1` (the position at 0) and `struct MapHeader` (the section byte). Money, the flag array
 * and the encryption key sit at profile offsets because they differ between games.
 */
export const PLAYER = {
  name: 0x00,
  nameLength: 7,
  trainerId: 0x0a,
  secretId: 0x0c,
  hours: 0x0e,
  minutes: 0x10,
  seconds: 0x11,
  frames: 0x12,
  identitySize: 0x13,
  /** `pos` is two s16 with no border offset, then `location` starts with the map group and number. */
  x: 0x00,
  y: 0x02,
  mapGroup: 0x04,
  mapNumber: 0x05,
  positionSize: 0x06,
  /** `MapHeader.regionMapSectionId`. */
  section: 0x14,
} as const;
