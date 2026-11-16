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
