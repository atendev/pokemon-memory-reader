import { z } from "zod";
import { TOPIC_NAMES } from "./meanings.js";
import type {
  ActiveBattle as ActiveBattleType,
  AdapterId,
  AdapterInfo as AdapterInfoType,
  AdapterProblem,
  Badge as BadgeType,
  BagEntry as BagEntryType,
  Bag as BagType,
  BattleMode,
  BattleMove as BattleMoveType,
  Battler as BattlerType,
  Battle as BattleType,
  Boxes as BoxesType,
  Box as BoxType,
  BridgeId,
  DataFormat,
  ErrorBody as ErrorBodyType,
  ErrorCode,
  Game as GameType,
  InactiveBattle as InactiveBattleType,
  LastBattle as LastBattleType,
  MapLocation as MapLocationType,
  Move as MoveType,
  Nature as NatureType,
  OpponentMon as OpponentMonType,
  Party as PartyType,
  Player as PlayerType,
  PlayTime as PlayTimeType,
  PocketId as PocketIdType,
  Pocket as PocketType,
  Pokemon as PokemonType,
  Ref as RefType,
  ResourceMap as ResourceMapType,
  Rom as RomType,
  SideConditions as SideConditionsType,
  StatStages as StatStagesType,
  Stats as StatsType,
  StatusResource as StatusResourceType,
  Status as StatusType,
  Topic as TopicType,
  Trainer as TrainerType,
  Type as TypeType,
} from "./types.js";

/** Validated as a string and typed as the open union, so an unknown name from a newer server still parses. */
function openEnum<T extends string>() {
  return z.custom<T>((value) => typeof value === "string");
}

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
] as const satisfies readonly TypeType[];

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
] as const satisfies readonly NatureType[];

export const STATUSES = [
  "none",
  "sleep",
  "poison",
  "toxic",
  "burn",
  "freeze",
  "paralysis",
] as const satisfies readonly StatusType[];

export const Type = z.enum(TYPES);
export type Type = TypeType;

export const Nature = z.enum(NATURES);
export type Nature = NatureType;

export const Status = z.enum(STATUSES);
export type Status = StatusType;

export const Ref = z.looseObject({
  id: z.int(),
  name: z.string().nullable(),
});
export type Ref = RefType;

export const Stats = z.looseObject({
  hp: z.int(),
  atk: z.int(),
  def: z.int(),
  spa: z.int(),
  spd: z.int(),
  spe: z.int(),
});
export type Stats = StatsType;

export const Move = z.looseObject({
  id: z.int(),
  name: z.string().nullable(),
  type: Type.nullable(),
  pp: z.int(),
  maxPp: z.int().nullable(),
  ppUps: z.int().min(0).max(3),
});
export type Move = MoveType;

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
export type Pokemon = PokemonType;

/** The player's party, in slot order. */
export const Party = z.looseObject({ pokemon: z.array(Pokemon) });
export type Party = PartyType;

/** What a boxed Pokémon doesn't store is null, and the description says which fields (spec §7.9). */
const BOX_SLOTS_DESCRIPTION =
  "Box Pokémon use the Pokemon shape with the fields a box doesn't store set to null: hp, maxHp, stats and status in Gen 2 and Gen 3, and stats and maxHp in Gen 1. No stats are computed. In Gen 3 level is computed from experience and the growth rate, and the same holds for a boxed egg. Empty slots are null so indices hold.";

/** One PC box. A corrupt Gen 3 slot is `null` and listed in `corruptSlots`. */
export const Box = z.looseObject({
  index: z.int(),
  name: z.string().nullable(),
  wallpaper: z.int().nullable(),
  readable: z.boolean(),
  corruptSlots: z.array(z.int()),
  slots: z.array(Pokemon.nullable()).describe(BOX_SLOTS_DESCRIPTION),
});
export type Box = BoxType;

/** The `boxes` resource. `currentBox` is 0-based, and null when the storage block couldn't be read. */
export const Boxes = z.looseObject({
  currentBox: z.int().nullable(),
  boxes: z.array(Box),
});
export type Boxes = BoxesType;

/** A badge. `id` is the 0-based index in game order, and `name` is null for a hack profile (amendment 017 §3). */
export const Badge = z.looseObject({
  id: z.int(),
  name: z
    .string()
    .nullable()
    .describe("null for a hack profile, which may have renamed the badge."),
  obtained: z.boolean(),
});
export type Badge = BadgeType;

/** The player's position (amendment 017 §4). */
export const MapLocation = z.looseObject({
  mapGroup: z
    .int()
    .nullable()
    .describe("The game's raw map group. null in Gen 1, which has one map ID."),
  mapNumber: z.int(),
  x: z
    .int()
    .describe(
      "Steps from the map's left edge, as the game stores it, without the engine's border offset.",
    ),
  y: z
    .int()
    .describe(
      "Steps from the map's top edge, as the game stores it, without the engine's border offset.",
    ),
  section: Ref.nullable().describe(
    "The map section in Gen 3 and CFRU, the landmark in Gen 2 (a landmark ID, not a map header ID) and the town-map entry in Gen 1. name is null when the ID has no name, and the whole value is null when the game has no section for this map.",
  ),
});
export type MapLocation = MapLocationType;

/** The play time as the game stores it (amendment 017 §2). */
export const PlayTime = z.looseObject({
  hours: z
    .int()
    .min(0)
    .describe(
      "Unbounded in the schema because a hack can change the cap. Gen 1 stops at 255 hours and Gen 2-3 at 999, so clients must not assume 99.",
    ),
  minutes: z.int().min(0).max(59),
  seconds: z.int().min(0).max(59),
  frames: z.int().min(0).max(59),
});
export type PlayTime = PlayTimeType;

/** The `player` resource (amendment 017 §1). */
export const Player = z.looseObject({
  name: z.string(),
  trainerId: z.int().describe("The 16-bit trainer ID the game shows."),
  secretId: z
    .int()
    .nullable()
    .describe("The 16-bit secret ID. null in Gen 1-2, which have none."),
  money: z.int().describe("The decoded amount, after any encryption."),
  badges: z
    .array(Badge)
    .describe(
      "In game order, with id the 0-based index: 8 badges in Gen 1 and Gen 3, and 16 in Gen 2, Johto first and then Kanto.",
    ),
  location: MapLocation,
  playTime: PlayTime,
});
export type Player = PlayerType;

export const POCKET_IDS = [
  "items",
  "keyItems",
  "balls",
  "tmhm",
  "berries",
] as const satisfies readonly PocketIdType[];

/** The bag pockets, a closed enum (amendment 017 §5). */
export const PocketId = z.enum(POCKET_IDS);
export type PocketId = PocketIdType;

/** One item stack (amendment 017 §5). */
export const BagEntry = z.looseObject({
  item: Ref,
  quantity: z
    .int()
    .describe(
      "As stored, decrypted where the game encrypts it. Not capped in the schema, and 0 is kept in a slot pocket.",
    ),
});
export type BagEntry = BagEntryType;

/** One bag pocket (amendment 017 §5). */
export const Pocket = z.looseObject({
  id: PocketId,
  capacity: z.int().describe("The most distinct entries the pocket can hold."),
  items: z
    .array(BagEntry)
    .describe(
      "In slot order, with empty slots skipped. [] for an empty pocket.",
    ),
});
export type Pocket = PocketType;

/** The `bag` resource (amendment 017 §5). */
export const Bag = z.looseObject({
  pockets: z
    .array(Pocket)
    .describe(
      "Only the pockets the game has, in game order: Gen 3 has five, items, keyItems, balls, tmhm and berries.",
    ),
});
export type Bag = BagType;

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
export type Rom = RomType;

/** Where a table came from: shipped reference data, the ROM, or neither. null when the format has none. */
const NameSource = z.enum(["builtin", "rom", "unavailable"]).nullable();

/** The loaded game. `match` and `signature` say how sure identification is (spec §5.4). */
export const Game = z.looseObject({
  profileId: z.string(),
  name: z.string(),
  generation: z.int(),
  language: z.string(),
  dataFormat: openEnum<DataFormat>(),
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
export type Game = GameType;

/**
 * The adapter in use, or the highest-priority one with a problem while none is usable.
 * `problem` is an open enum, as are `id` and `bridge.bridge` (spec §7.11).
 */
export const AdapterInfo = z.looseObject({
  id: openEnum<AdapterId>(),
  /** True after 1 s of consecutive read timeouts (spec §8.6). Always false until the stall check lands. */
  stalled: z.boolean(),
  bridge: z
    .looseObject({
      bridge: openEnum<BridgeId>(),
      protocol: z.int(),
      build: z.string().nullable(),
      emulator: z
        .looseObject({ name: z.string(), version: z.string().nullable() })
        .nullable(),
    })
    .nullable(),
  problem: openEnum<AdapterProblem>().nullable(),
});
export type AdapterInfo = AdapterInfoType;

/** The `status` resource. Always served with 200 (spec §7.2). Named apart from the `Status` condition enum. */
export const StatusResource = z.looseObject({
  state: z.enum(["disconnected", "no_game", "unidentified", "game"]),
  adapter: AdapterInfo.nullable(),
  rom: Rom.nullable(),
  game: Game.nullable(),
});
export type StatusResource = StatusResourceType;

/**
 * Every 503 and 404 body (amendment 020 §1). `code` is an open enum, so clients branch on it and
 * never on `message`, which is English text without a stability promise.
 */
export const ErrorBody = z.looseObject({
  error: z.looseObject({ code: openEnum<ErrorCode>(), message: z.string() }),
  status: StatusResource,
});
export type ErrorBody = ErrorBodyType;

/** -6 to +6 in every generation. Gen 1's single Special stage fills both `spa` and `spd`. */
export const StatStages = z.looseObject({
  atk: z.int().min(-6).max(6),
  def: z.int().min(-6).max(6),
  spa: z.int().min(-6).max(6),
  spd: z.int().min(-6).max(6),
  spe: z.int().min(-6).max(6),
  acc: z.int().min(-6).max(6),
  eva: z.int().min(-6).max(6),
});
export type StatStages = StatStagesType;

export const BattleMove = z.looseObject({
  id: z.int(),
  name: z.string().nullable(),
  pp: z.int(),
  maxPp: z.int().nullable(),
});
export type BattleMove = BattleMoveType;

export const Battler = z.looseObject({
  position: z.int(),
  owner: z.enum(["player", "partner", "opponent"]),
  partySlot: z.int().nullable(),
  species: Pokemon.shape.species,
  level: z.int(),
  types: z.array(Type).nullable(),
  hp: z.int(),
  maxHp: z.int(),
  status: Status.nullable(),
  ability: Ref.nullable(),
  heldItem: Ref.nullable(),
  moves: z.array(BattleMove),
  stats: Stats,
  statStages: StatStages,
});
export type Battler = BattlerType;

export const Trainer = z.looseObject({
  id: z.int(),
  classId: z.int().nullable(),
  className: z.string().nullable(),
  name: z.string().nullable(),
  prizeMoney: z
    .int()
    .nullable()
    .describe(
      "The expected payout on a win, without Pay Day money. In Gen 3 it is 4 × the last mon's level × the money multiplier × the class's table value, doubled for a double battle against one trainer. A two-opponent battle pays each trainer its own amount, undoubled, as the game does. null when any input is missing.",
    ),
  items: z
    .array(Ref)
    .nullable()
    .describe(
      "The trainer's starting items in Gen 3 (empty slots left out), and null when the trainers table is missing.",
    ),
});
export type Trainer = TrainerType;

export const OpponentMon = z.looseObject({
  ...Pokemon.shape,
  partySlot: z.int(),
  trainer: z.int().nullable(),
  revealed: z.boolean(),
});
export type OpponentMon = OpponentMonType;

export const SideConditions = z.looseObject({
  reflect: z.boolean().nullable(),
  lightScreen: z.boolean().nullable(),
  safeguard: z.boolean().nullable(),
  mist: z.boolean().nullable(),
  spikes: z.int().nullable(),
});
export type SideConditions = SideConditionsType;

export const BATTLE_KINDS = ["wild", "trainer"] as const;
export const BATTLE_FORMATS = ["single", "double"] as const;
export const BATTLE_OUTCOMES = [
  "won",
  "lost",
  "drew",
  "ran",
  "caught",
  "forfeited",
  "unknown",
] as const;

const Modes = z.array(openEnum<BattleMode>());

export const LastBattle = z.looseObject({
  battleId: z.int(),
  outcome: z.enum(BATTLE_OUTCOMES),
  endedAt: z.iso.datetime(),
  kind: z.enum(BATTLE_KINDS),
  format: z.enum(BATTLE_FORMATS),
  modes: Modes,
  trainers: z.array(Trainer),
  opponentParty: z.array(OpponentMon),
});
export type LastBattle = LastBattleType;

export const InactiveBattle = z.looseObject({
  active: z.literal(false),
  lastBattle: LastBattle.nullable(),
});
export type InactiveBattle = InactiveBattleType;

export const ActiveBattle = z.looseObject({
  active: z.literal(true),
  battleId: z.int(),
  kind: z.enum(BATTLE_KINDS),
  format: z.enum(BATTLE_FORMATS),
  modes: Modes,
  turn: z.int().nullable(),
  player: z.looseObject({
    active: z.array(Battler),
    partner: Trainer.nullable(),
  }),
  opponent: z.looseObject({
    active: z.array(Battler),
    party: z.array(OpponentMon),
    trainers: z.array(Trainer),
  }),
  field: z.looseObject({
    weather: z.enum(["none", "rain", "sun", "sandstorm", "hail"]).nullable(),
    terrain: z
      .enum(["none", "electric", "grassy", "misty", "psychic"])
      .nullable(),
    sides: z.looseObject({
      player: SideConditions,
      opponent: SideConditions,
    }),
  }),
});
export type ActiveBattle = ActiveBattleType;

/** The `battle` resource, a union discriminated by `active`. */
export const Battle = z.discriminatedUnion("active", [
  InactiveBattle,
  ActiveBattle,
]);
export type Battle = BattleType;

/**
 * The resources the server serves so far, in the order of the topic record. `bag`
 * and `boxes` join the record and `resourceSchemas` as their decoders land, which is an additive
 * change inside `/api/v2`.
 */
export const TOPICS = Object.keys(TOPIC_NAMES) as readonly TopicType[];
export type Topic = TopicType;

export const resourceSchemas = {
  status: StatusResource,
  party: Party,
  player: Player,
  bag: Bag,
  battle: Battle,
  boxes: Boxes,
} satisfies Record<Topic, z.ZodType>;

export type ResourceMap = ResourceMapType;
