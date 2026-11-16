import type {
  Pokemon,
  StatusResource,
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
