/**
 * The hand-written TypeScript types for every resource. Type-only, so the compiled module is empty.
 * This file imports only types from `./meanings.js`, which holds the open-enum records and imports
 * nothing, and never `zod` or `./schemas.js`, so `/types` and `/client` users never install Zod
 * (spec §10, amendment 054). `sync.test.ts` checks each type equal to its schema's inferred type.
 * Each loose object carries an index signature, like `z.looseObject`.
 */

import type {
  ADAPTER_IDS,
  ADAPTER_PROBLEMS,
  BATTLE_MODES,
  BRIDGE_IDS,
  DATA_FORMATS,
  ERROR_CODES,
  TOPIC_NAMES,
} from "./meanings.js";

/**
 * Each open enum (spec §7.11) is its known union, derived from the keys of its meaning record
 * (amendment 035), plus `(string & {})` so a client tolerates names a newer server adds.
 * The `(string & {})` keeps editor completion for the known names.
 */
export type KnownErrorCode = keyof typeof ERROR_CODES;
export type ErrorCode = KnownErrorCode | (string & {});
export type KnownDataFormat = keyof typeof DATA_FORMATS;
export type DataFormat = KnownDataFormat | (string & {});
export type KnownAdapterId = keyof typeof ADAPTER_IDS;
export type AdapterId = KnownAdapterId | (string & {});
export type KnownBridgeId = keyof typeof BRIDGE_IDS;
export type BridgeId = KnownBridgeId | (string & {});
export type KnownAdapterProblem = keyof typeof ADAPTER_PROBLEMS;
export type AdapterProblem = KnownAdapterProblem | (string & {});
/** Empty until a mode's verification fixture lands (amendment 015), so only the open part applies. */
export type KnownBattleMode = keyof typeof BATTLE_MODES;
export type BattleMode = KnownBattleMode | (string & {});

export type Type =
  | "normal"
  | "fighting"
  | "flying"
  | "poison"
  | "ground"
  | "rock"
  | "bug"
  | "ghost"
  | "steel"
  | "mystery"
  | "fire"
  | "water"
  | "grass"
  | "electric"
  | "psychic"
  | "ice"
  | "dragon"
  | "dark"
  | "fairy";

export type Nature =
  | "hardy"
  | "lonely"
  | "brave"
  | "adamant"
  | "naughty"
  | "bold"
  | "docile"
  | "relaxed"
  | "impish"
  | "lax"
  | "timid"
  | "hasty"
  | "serious"
  | "jolly"
  | "naive"
  | "modest"
  | "mild"
  | "quiet"
  | "bashful"
  | "rash"
  | "calm"
  | "gentle"
  | "sassy"
  | "careful"
  | "quirky";

export type Status =
  | "none"
  | "sleep"
  | "poison"
  | "toxic"
  | "burn"
  | "freeze"
  | "paralysis";

export type Ref = {
  id: number;
  name: string | null;
  [key: string]: unknown;
};

export type Stats = {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  [key: string]: unknown;
};

export type Move = {
  id: number;
  name: string | null;
  type: Type | null;
  pp: number;
  maxPp: number | null;
  /** 0 to 3. */
  ppUps: number;
  [key: string]: unknown;
};

export type Pokemon = {
  species: {
    id: number;
    dex: number | null;
    name: string | null;
    [key: string]: unknown;
  };
  nickname: string | null;
  ot: {
    name: string;
    id: number;
    secretId: number | null;
    gender: "male" | "female" | null;
    [key: string]: unknown;
  } | null;
  isEgg: boolean;
  eggCycles: number | null;
  level: number | null;
  experience: number | null;
  /** 0 to 255. */
  friendship: number | null;
  types: Type[] | null;
  hp: number | null;
  maxHp: number | null;
  stats: Stats | null;
  ivs: Stats;
  evs: Stats | null;
  status: Status | null;
  ability: Ref | null;
  heldItem: Ref | null;
  nature: Nature | null;
  ball: Ref | null;
  pokerus: "none" | "infected" | "cured" | null;
  moves: Move[];
  met: {
    location: Ref | null;
    level: number | null;
    game:
      | "sapphire"
      | "ruby"
      | "emerald"
      | "firered"
      | "leafgreen"
      | "gamecube"
      | null;
    timeOfDay: "morning" | "day" | "night" | null;
    [key: string]: unknown;
  } | null;
  personality: number | null;
  language: number | null;
  shiny: boolean;
  gender: "male" | "female" | "genderless" | null;
  hiddenPower: {
    type: Type;
    power: number;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

/** The player's party, in slot order. */
export type Party = {
  pokemon: Pokemon[];
  [key: string]: unknown;
};

/**
 * One PC box. A readable box's `slots` has a fixed length (30 in Gen 3) in game slot order, with
 * `null` for empty slots so indices hold. An unreadable box has `readable: false` and empty
 * `slots` and `corruptSlots`, and keeps `name` and `wallpaper` where known. `corruptSlots` lists
 * the `null` slots that hold a Pokémon the program couldn't decode (checksum failure or bad egg).
 */
export type Box = {
  index: number;
  name: string | null;
  wallpaper: number | null;
  readable: boolean;
  corruptSlots: number[];
  slots: (Pokemon | null)[];
  [key: string]: unknown;
};

/** The player's PC boxes. `currentBox` is 0-based and null when the game's storage couldn't be read. */
export type Boxes = {
  currentBox: number | null;
  boxes: Box[];
  [key: string]: unknown;
};

/** One badge. `id` is the 0-based index in game order. `name` is null for a hack profile, which may have renamed the badges. */
export type Badge = {
  id: number;
  name: string | null;
  obtained: boolean;
  [key: string]: unknown;
};

/**
 * Where the player stands. `mapGroup` is null in Gen 1, which has one map ID. `x` and `y` are
 * step units from the map's top-left corner, without the engine's border offset. `section` is
 * the map section (Gen 3), landmark (Gen 2) or town-map entry (Gen 1), and null when the game
 * has none for this map.
 */
export type MapLocation = {
  mapGroup: number | null;
  mapNumber: number;
  x: number;
  y: number;
  section: Ref | null;
  [key: string]: unknown;
};

/** The play time as the game stores it. Gen 1 stops at 255 hours and Gen 2-3 at 999, so don't assume 99. */
export type PlayTime = {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
  [key: string]: unknown;
};

/**
 * The `player` resource. `secretId` is null in Gen 1-2. `badges` lists 8 in Gen 1 and Gen 3 and
 * 16 in Gen 2 (Johto, then Kanto), in game order.
 */
export type Player = {
  name: string;
  trainerId: number;
  secretId: number | null;
  money: number;
  badges: Badge[];
  location: MapLocation;
  playTime: PlayTime;
  [key: string]: unknown;
};

/** The bag pockets (amendment 017 §5). A closed enum: every supported format has a fixed pocket set. */
export type PocketId = "items" | "keyItems" | "balls" | "tmhm" | "berries";

/** One item stack. `item.name` is null for an ID the name table doesn't know. */
export type BagEntry = {
  item: Ref;
  quantity: number;
  [key: string]: unknown;
};

/** One pocket. `capacity` is the most distinct entries it can hold, and an empty pocket has `items: []`. */
export type Pocket = {
  id: PocketId;
  capacity: number;
  items: BagEntry[];
  [key: string]: unknown;
};

/** The `bag` resource. It lists only the pockets the game has, in game order. */
export type Bag = {
  pockets: Pocket[];
  [key: string]: unknown;
};

/** What the adapter reports about the loaded ROM. null when the adapter reports no ROM (amendment 020 §5). */
export type Rom = {
  platform: "gb" | "gba" | "other";
  title: string | null;
  gameCode: string | null;
  revision: number | null;
  globalChecksum: string | null;
  crc32: string | null;
  sha1: string | null;
  contentName: string | null;
  expansion: {
    version: string;
    tagged: boolean;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

/** Where a table came from: shipped reference data, the ROM, or neither. null when the format has none. */
type NameSource = "builtin" | "rom" | "unavailable" | null;

/** The loaded game. `match` and `signature` say how sure identification is (spec §5.4). */
export type Game = {
  profileId: string;
  name: string;
  generation: number;
  language: string;
  dataFormat: DataFormat;
  match: "exact" | "header" | "manual";
  signature: "match" | "mismatch" | "unchecked" | null;
  features: {
    boxes: boolean;
    [key: string]: unknown;
  };
  names: {
    species: NameSource;
    moves: NameSource;
    items: NameSource;
    abilities: NameSource;
    [key: string]: unknown;
  };
  speciesData: {
    info: NameSource;
    dex: NameSource;
    exp: NameSource;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/**
 * The adapter in use, or the highest-priority one with a problem while none is usable.
 * `problem` is an open enum, as are `id` and `bridge.bridge` (spec §7.11).
 */
export type AdapterInfo = {
  id: AdapterId;
  /** True after 1 s of consecutive read timeouts (spec §8.6). Always false until the stall check lands. */
  stalled: boolean;
  bridge: {
    bridge: BridgeId;
    protocol: number;
    build: string | null;
    emulator: {
      name: string;
      version: string | null;
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  } | null;
  problem: AdapterProblem | null;
  [key: string]: unknown;
};

/** The `status` resource. Always served with 200 (spec §7.2). Named apart from the `Status` condition enum. */
export type StatusResource = {
  state: "disconnected" | "no_game" | "unidentified" | "game";
  adapter: AdapterInfo | null;
  rom: Rom | null;
  game: Game | null;
  [key: string]: unknown;
};

/**
 * Every 503 and 404 body (amendment 020 §1). `code` is an open enum, so clients branch on it and
 * never on `message`, which is English text without a stability promise.
 */
export type ErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    [key: string]: unknown;
  };
  status: StatusResource;
  [key: string]: unknown;
};

/**
 * The resources the server serves so far, derived from the topic record. `bag`
 * joins the record and `ResourceMap` as its decoder lands, which is an additive change
 * inside `/api/v2`. Topic names are an open enum, but a topic you can fetch is always a known one.
 */
export type Topic = keyof typeof TOPIC_NAMES;

export type ResourceMap = {
  status: StatusResource;
  party: Party;
  player: Player;
  bag: Bag;
  battle: Battle;
  boxes: Boxes;
};

/**
 * One event of the `/events` stream (spec §7.3): the SSE event name is the topic and the data is
 * that resource, the same body a `GET` of it returns.
 */
export type StreamEvent = {
  [T in Topic]: { topic: T; data: ResourceMap[T] };
}[Topic];

/** The state of a `subscribe` connection (spec §10). */
export type ConnectionState = "connecting" | "open" | "reconnecting" | "closed";

/** A stat stage, -6 to +6 in every generation. Gen 1's single Special stage fills both `spa` and `spd`. */
export type StatStages = {
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  acc: number;
  eva: number;
  [key: string]: unknown;
};

/** A move in battle: live PP from the battle struct. */
export type BattleMove = {
  id: number;
  name: string | null;
  pp: number;
  maxPp: number | null;
  [key: string]: unknown;
};

/**
 * A mon on the field, read live from the battle struct, so a Transformed mon shows the copied
 * species, types and moves. `partySlot` indexes the side's party as the game stores it, and is null
 * only for partner battlers whose mons aren't in party memory.
 */
export type Battler = {
  position: number;
  owner: "player" | "partner" | "opponent";
  partySlot: number | null;
  species: Pokemon["species"];
  level: number;
  types: Type[] | null;
  hp: number;
  maxHp: number;
  status: Status | null;
  ability: Ref | null;
  heldItem: Ref | null;
  moves: BattleMove[];
  stats: Stats;
  statStages: StatStages;
  [key: string]: unknown;
};

/**
 * A trainer in the battle. The table-derived fields are null when the profile's ROM table is missing
 * and in link, Tower and Frontier battles. `prizeMoney` is the expected payout on a win, without Pay
 * Day money. In Gen 3 it is doubled for a double battle against one trainer, and a two-opponent
 * battle pays each trainer its own amount undoubled, as the game does. `items` is the remaining list in Gen 2, the starting list in Gen 3 and null in Gen 1.
 */
export type Trainer = {
  id: number;
  classId: number | null;
  className: string | null;
  name: string | null;
  prizeMoney: number | null;
  items: Ref[] | null;
  [key: string]: unknown;
};

type Flatten<T> = { [K in keyof T]: T[K] };

/**
 * An opponent party mon. `revealed` is the program's best effort: a trainer mon is revealed once a
 * valid frame lists its slot on the field or its HP is below max, and a wild mon always is. If the
 * program attaches mid-battle, a mon sent out earlier that is back at full HP reads as unrevealed.
 * `trainer` indexes `opponent.trainers` and is null for wild mons.
 */
export type OpponentMon = Flatten<
  Pokemon & {
    partySlot: number;
    trainer: number | null;
    revealed: boolean;
  }
>;

export type SideConditions = {
  reflect: boolean | null;
  lightScreen: boolean | null;
  safeguard: boolean | null;
  mist: boolean | null;
  spikes: number | null;
  [key: string]: unknown;
};

export type BattleField = {
  weather: "none" | "rain" | "sun" | "sandstorm" | "hail" | null;
  terrain: "none" | "electric" | "grassy" | "misty" | "psychic" | null;
  sides: {
    player: SideConditions;
    opponent: SideConditions;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/**
 * Which outcomes a generation can report: Gen 3 and CFRU map `gBattleOutcome` to all but `unknown`
 * where the game sets them, and Gen 1-2 report `unknown` until their fixtures land.
 */
export type BattleOutcome =
  | "won"
  | "lost"
  | "drew"
  | "ran"
  | "caught"
  | "forfeited"
  | "unknown";

/** The last finished battle. Everything except `outcome` and `endedAt` is frozen from the last valid active snapshot. */
export type LastBattle = {
  battleId: number;
  outcome: BattleOutcome;
  /** ISO 8601 UTC, from the program's clock. */
  endedAt: string;
  kind: "wild" | "trainer";
  format: "single" | "double";
  modes: BattleMode[];
  trainers: Trainer[];
  opponentParty: OpponentMon[];
  [key: string]: unknown;
};

export type InactiveBattle = {
  active: false;
  /** Never carried while a battle is active. null until a battle ends in this session. */
  lastBattle: LastBattle | null;
  [key: string]: unknown;
};

/** `battleId` is unique only within one session: it resets on a game change or a program restart. */
export type ActiveBattle = {
  active: true;
  battleId: number;
  kind: "wild" | "trainer";
  format: "single" | "double";
  modes: BattleMode[];
  turn: number | null;
  player: {
    active: Battler[];
    partner: Trainer | null;
    [key: string]: unknown;
  };
  opponent: {
    active: Battler[];
    party: OpponentMon[];
    trainers: Trainer[];
    [key: string]: unknown;
  };
  field: BattleField;
  [key: string]: unknown;
};

/** The `battle` resource, a union discriminated by `active`. */
export type Battle = ActiveBattle | InactiveBattle;
