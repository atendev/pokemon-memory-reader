import { z } from "zod";

export const TYPES = [
  "normal",
  "fighting",
  "flying",
  "poison",
  "ground",
  "rock",
  "bug",
  "ghost",
  "steel",
  "mystery",
  "fire",
  "water",
  "grass",
  "electric",
  "psychic",
  "ice",
  "dragon",
  "dark",
  "fairy",
] as const;

/** The 25 natures in Gen 3 ID order, so `personality % 25` indexes this list. */
export const NATURES = [
  "hardy",
  "lonely",
  "brave",
  "adamant",
  "naughty",
  "bold",
  "docile",
  "relaxed",
  "impish",
  "lax",
  "timid",
  "hasty",
  "serious",
  "jolly",
  "naive",
  "modest",
  "mild",
  "quiet",
  "bashful",
  "rash",
  "calm",
  "gentle",
  "sassy",
  "careful",
  "quirky",
] as const;

export const STATUSES = [
  "none",
  "sleep",
  "poison",
  "toxic",
  "burn",
  "freeze",
  "paralysis",
] as const;

export const Type = z.enum(TYPES);
export type Type = z.infer<typeof Type>;

export const Nature = z.enum(NATURES);
export type Nature = z.infer<typeof Nature>;

export const Status = z.enum(STATUSES);
export type Status = z.infer<typeof Status>;

export const Ref = z.looseObject({
  id: z.int(),
  name: z.string().nullable(),
});
export type Ref = z.infer<typeof Ref>;

export const Stats = z.looseObject({
  hp: z.int(),
  atk: z.int(),
  def: z.int(),
  spa: z.int(),
  spd: z.int(),
  spe: z.int(),
});
export type Stats = z.infer<typeof Stats>;

export const Move = z.looseObject({
  id: z.int(),
  name: z.string().nullable(),
  type: Type.nullable(),
  pp: z.int(),
  maxPp: z.int().nullable(),
  ppUps: z.int().min(0).max(3),
});
export type Move = z.infer<typeof Move>;

export const Pokemon = z.looseObject({
  species: z.looseObject({
    id: z.int(),
    dex: z.int().nullable(),
    name: z.string().nullable(),
  }),
  nickname: z.string().nullable(),
  ot: z
    .looseObject({
      name: z.string(),
      id: z.int(),
      secretId: z.int().nullable(),
      gender: z.enum(["male", "female"]).nullable(),
    })
    .nullable(),
  isEgg: z.boolean(),
  eggCycles: z.int().nullable(),
  level: z.int().nullable(),
  experience: z.int().nullable(),
  friendship: z.int().min(0).max(255).nullable(),
  types: z.array(Type).nullable(),
  hp: z.int().nullable(),
  maxHp: z.int().nullable(),
  stats: Stats.nullable(),
  ivs: Stats,
  evs: Stats.nullable(),
  status: Status.nullable(),
  ability: Ref.nullable(),
  heldItem: Ref.nullable(),
  nature: Nature.nullable(),
  ball: Ref.nullable(),
  pokerus: z.enum(["none", "infected", "cured"]).nullable(),
  moves: z.array(Move),
  met: z
    .looseObject({
      location: Ref.nullable(),
      level: z.int().nullable(),
      game: z
        .enum([
          "sapphire",
          "ruby",
          "emerald",
          "firered",
          "leafgreen",
          "gamecube",
        ])
        .nullable(),
      timeOfDay: z.enum(["morning", "day", "night"]).nullable(),
    })
    .nullable(),
  personality: z.int().nullable(),
  language: z.int().nullable(),
  shiny: z.boolean(),
  gender: z.enum(["male", "female", "genderless"]).nullable(),
  hiddenPower: z.looseObject({ type: Type, power: z.int() }).nullable(),
});
export type Pokemon = z.infer<typeof Pokemon>;

/** The player's party, in slot order. */
export const Party = z.looseObject({ pokemon: z.array(Pokemon) });
export type Party = z.infer<typeof Party>;

const Hash = z.string().nullable();

/** What the adapter reports about the loaded ROM. null when the adapter reports no ROM (amendment 020 §5). */
export const Rom = z.looseObject({
  platform: z.enum(["gb", "gba", "other"]),
  title: z.string().nullable(),
  gameCode: z.string().nullable(),
  revision: z.int().nullable(),
  globalChecksum: z.string().nullable(),
  crc32: Hash,
  sha1: Hash,
  contentName: z.string().nullable(),
  expansion: z
    .looseObject({ version: z.string(), tagged: z.boolean() })
    .nullable(),
});
export type Rom = z.infer<typeof Rom>;

/** Where a table came from: shipped reference data, the ROM, or neither. null when the format has none. */
const NameSource = z.enum(["builtin", "rom", "unavailable"]).nullable();

/** The loaded game. `match` and `signature` say how sure identification is (spec §5.4). */
export const Game = z.looseObject({
  profileId: z.string(),
  name: z.string(),
  generation: z.int(),
  language: z.string(),
  dataFormat: z.string(),
  match: z.enum(["exact", "header", "manual"]),
  signature: z.enum(["match", "mismatch", "unchecked"]).nullable(),
  features: z.looseObject({ boxes: z.boolean() }),
  names: z.looseObject({
    species: NameSource,
    moves: NameSource,
    items: NameSource,
    abilities: NameSource,
  }),
  speciesData: z.looseObject({
    info: NameSource,
    dex: NameSource,
    exp: NameSource,
  }),
});
export type Game = z.infer<typeof Game>;

/**
 * The adapter in use, or the highest-priority one with a problem while none is usable.
 * `problem` is an open enum, as are `id` and `bridge.bridge` (spec §7.11).
 */
export const AdapterInfo = z.looseObject({
  id: z.string(),
  /** True after 1 s of consecutive read timeouts (spec §8.6). Always false until the stall check lands. */
  stalled: z.boolean(),
  bridge: z
    .looseObject({
      bridge: z.string(),
      protocol: z.int(),
      build: z.string().nullable(),
      emulator: z
        .looseObject({ name: z.string(), version: z.string().nullable() })
        .nullable(),
    })
    .nullable(),
  problem: z.string().nullable(),
});
export type AdapterInfo = z.infer<typeof AdapterInfo>;

/** The `status` resource. Always served with 200 (spec §7.2). Named apart from the `Status` condition enum. */
export const StatusResource = z.looseObject({
  state: z.enum(["disconnected", "no_game", "unidentified", "game"]),
  adapter: AdapterInfo.nullable(),
  rom: Rom.nullable(),
  game: Game.nullable(),
});
export type StatusResource = z.infer<typeof StatusResource>;

/**
 * Every 503 and 404 body (amendment 020 §1). `code` is an open enum, so clients branch on it and
 * never on `message`, which is English text without a stability promise.
 */
export const ErrorBody = z.looseObject({
  error: z.looseObject({ code: z.string(), message: z.string() }),
  status: StatusResource,
});
export type ErrorBody = z.infer<typeof ErrorBody>;

/**
 * The resources the server serves so far. `player`, `bag`, `battle` and `boxes` join this tuple
 * and `resourceSchemas` as their decoders land, which is an additive change inside `/api/v2`.
 */
export const TOPICS = ["status", "party"] as const;
export type Topic = (typeof TOPICS)[number];

export const resourceSchemas = {
  status: StatusResource,
  party: Party,
} satisfies Record<Topic, z.ZodType>;

export type ResourceMap = {
  [T in Topic]: z.infer<(typeof resourceSchemas)[T]>;
};
