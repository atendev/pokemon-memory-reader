import type {
  Battler,
  Pokemon,
  Trainer,
} from "@pokemon-memory-reader/api/schemas";
import type {
  BattleFrame,
  OpponentMonFrame,
} from "../../src/resource/battle-tracker";

const stats = { hp: 20, atk: 10, def: 10, spa: 10, spd: 10, spe: 10 };

export function pokemon(overrides: Partial<Pokemon> = {}): Pokemon {
  return {
    species: { id: 1, dex: 1, name: "BULBASAUR" },
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
    ivs: stats,
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

export function opponentMon(
  partySlot: number,
  overrides: Partial<OpponentMonFrame> = {},
): OpponentMonFrame {
  return {
    ...pokemon(),
    partySlot,
    trainer: null,
    ...overrides,
  };
}

export function battler(
  owner: Battler["owner"],
  partySlot: number | null,
  overrides: Partial<Battler> = {},
): Battler {
  return {
    position: owner === "opponent" ? 1 : 0,
    owner,
    partySlot,
    species: { id: 1, dex: 1, name: "BULBASAUR" },
    level: 5,
    types: null,
    hp: 20,
    maxHp: 20,
    status: null,
    ability: null,
    heldItem: null,
    moves: [],
    stats: stats,
    statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 },
    ...overrides,
  };
}

export const trainer: Trainer = {
  id: 1,
  classId: null,
  className: null,
  name: null,
  prizeMoney: null,
  items: null,
};

const side = {
  reflect: false,
  lightScreen: false,
  safeguard: false,
  mist: false,
  spikes: 0,
};

/** A single trainer battle with a three-mon opponent party and only slot 0 on the field. */
export function trainerFrame(
  overrides: Partial<BattleFrame> = {},
): BattleFrame {
  return {
    kind: "trainer",
    format: "single",
    modes: [],
    turn: null,
    player: { active: [battler("player", 0)], partner: null },
    opponent: {
      active: [battler("opponent", 0)],
      party: [
        opponentMon(0, { trainer: 0 }),
        opponentMon(1, { trainer: 0 }),
        opponentMon(2, { trainer: 0 }),
      ],
      trainers: [trainer],
    },
    field: {
      weather: "none",
      terrain: null,
      sides: { player: side, opponent: side },
    },
    ...overrides,
  };
}

export function wildFrame(overrides: Partial<BattleFrame> = {}): BattleFrame {
  return trainerFrame({
    kind: "wild",
    opponent: {
      active: [battler("opponent", 0)],
      party: [opponentMon(0)],
      trainers: [],
    },
    ...overrides,
  });
}
