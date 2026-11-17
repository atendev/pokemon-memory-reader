/**
 * The hand-written TypeScript types for every resource. Type-only, so the compiled module is empty.
 * This file imports nothing, least of all `zod` or `./schemas.js`, so `/types` and `/client`
 * users never install Zod (spec §10, amendment 054). `sync.test.ts` checks each type equal
 * to its schema's inferred type. Each loose object carries an index signature, like `z.looseObject`.
 */

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
  dataFormat: string;
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
  id: string;
  /** True after 1 s of consecutive read timeouts (spec §8.6). Always false until the stall check lands. */
  stalled: boolean;
  bridge: {
    bridge: string;
    protocol: number;
    build: string | null;
    emulator: {
      name: string;
      version: string | null;
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  } | null;
  problem: string | null;
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
    code: string;
    message: string;
    [key: string]: unknown;
  };
  status: StatusResource;
  [key: string]: unknown;
};

/**
 * The resources the server serves so far. `player`, `bag`, `battle` and `boxes` join this union
 * and `ResourceMap` as their decoders land, which is an additive change inside `/api/v2`.
 */
export type Topic = "status" | "party";

export type ResourceMap = {
  status: StatusResource;
  party: Party;
};
