import type {
  ActiveBattle,
  Battler,
  OpponentMon,
  Pokemon,
  StatusResource,
  Trainer,
} from "@pokemon-memory-reader/api/schemas";

const ZERO_STATS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

/** A synthetic Pokémon for tests. Every nullable field starts null, so a test sets only what it checks. */
export function mon(overrides: Partial<Pokemon> = {}): Pokemon {
  return {
    species: { id: 252, dex: 252, name: "Treecko" },
    nickname: null,
    ot: null,
    isEgg: false,
    eggCycles: null,
    level: 5,
    experience: null,
    friendship: null,
    types: null,
    hp: 20,
    maxHp: 20,
    stats: null,
    ivs: ZERO_STATS,
    evs: null,
    status: null,
    ability: null,
    heldItem: null,
    nature: null,
    ball: null,
    pokerus: null,
    moves: [],
    met: null,
    personality: null,
    language: null,
    shiny: false,
    gender: null,
    hiddenPower: null,
    ...overrides,
  };
}

export function status(
  state: StatusResource["state"],
  overrides: Partial<StatusResource> = {},
): StatusResource {
  return { state, adapter: null, rom: null, game: null, ...overrides };
}

const NO_STAGES = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };

export function battler(overrides: Partial<Battler> = {}): Battler {
  return {
    position: 0,
    owner: "player",
    partySlot: 0,
    species: { id: 252, dex: 252, name: "Treecko" },
    level: 5,
    types: ["grass"],
    hp: 20,
    maxHp: 20,
    status: null,
    ability: null,
    heldItem: null,
    moves: [],
    stats: ZERO_STATS,
    statStages: NO_STAGES,
    ...overrides,
  };
}

export function opponentMon(overrides: Partial<OpponentMon> = {}): OpponentMon {
  return {
    ...mon({ species: { id: 261, dex: 261, name: "Poochyena" } }),
    partySlot: 0,
    trainer: 0,
    revealed: true,
    ...overrides,
  };
}

export function trainer(overrides: Partial<Trainer> = {}): Trainer {
  return {
    id: 1,
    classId: null,
    className: null,
    name: null,
    prizeMoney: null,
    items: null,
    ...overrides,
  };
}

const NO_SIDE = {
  reflect: null,
  lightScreen: null,
  safeguard: null,
  mist: null,
  spikes: null,
};

/** A single wild battle with nothing set. A test spreads in only what it checks. */
export function activeBattle(
  overrides: Partial<ActiveBattle> = {},
): ActiveBattle {
  return {
    active: true,
    battleId: 1,
    kind: "wild",
    format: "single",
    modes: [],
    turn: null,
    player: { active: [battler()], partner: null },
    opponent: {
      active: [battler({ owner: "opponent", partySlot: 0 })],
      party: [opponentMon({ trainer: null })],
      trainers: [],
    },
    field: {
      weather: null,
      terrain: null,
      sides: { player: NO_SIDE, opponent: NO_SIDE },
    },
    ...overrides,
  };
}

type SettingsBody =
  import("@pokemon-memory-reader/internal/settings-route").SettingsBody;

const entry = <T>(
  value: T,
  source: "flag" | "file" | "default" = "default",
) => ({
  value,
  source,
  restartRequired: false,
});

/** A `GET /settings` body with the defaults, on this computer, with saves allowed. Tests override what they check. */
export function settingsBody(
  overrides: Partial<SettingsBody> = {},
): SettingsBody {
  return {
    settings: {
      port: { ...entry(7425), restartRequired: true },
      host: { ...entry("127.0.0.1"), restartRequired: true },
      openBrowser: { ...entry(true), restartRequired: true },
      adapter: entry("auto" as const),
      adapters: entry({
        mgba: { host: "127.0.0.1", port: 7426 },
        retroarch: { host: "127.0.0.1", port: 55355 },
        bizhawk: { host: "127.0.0.1", port: 7427 },
      }),
      pollHz: entry(20),
      updateCheck: entry(true),
      icons: entry({ mode: "online" as const, baseUrl: null }),
    },
    saves: { writable: true, refusal: null },
    paths: {
      dataFolder: "/home/me/.pmr",
      configFile: "/home/me/.pmr/config.json",
      profiles: "/home/me/.pmr/profiles",
      bridges: "/home/me/.pmr/bridges",
      iconPack: "/home/me/.pmr/icons",
      iconCache: "/home/me/.pmr/icon-cache",
    },
    iconCache: { bytes: 0 },
    ...overrides,
  };
}

type Game = NonNullable<StatusResource["game"]>;

/** An exact-match official Gen 3 game with every table readable. A test overrides only what it checks. */
export function game(overrides: Partial<Game> = {}): Game {
  return {
    profileId: "emerald-us-1.0",
    name: "Pokémon Emerald (US)",
    generation: 3,
    language: "en",
    dataFormat: "gen3",
    match: "exact",
    signature: "match",
    features: { boxes: true },
    names: {
      species: "builtin",
      moves: "builtin",
      items: "builtin",
      abilities: "builtin",
    },
    speciesData: { info: "builtin", dex: "builtin", exp: "builtin" },
    ...overrides,
  };
}
