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
