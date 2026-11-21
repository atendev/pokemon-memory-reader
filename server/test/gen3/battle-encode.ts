import { encodeMon, type MonSpec, partyBytes } from "./encode";

/** The fields of a `struct BattlePokemon` the decoder reads (pokeemerald `include/pokemon.h`). */
export interface BattleMonSpec {
  species: number;
  level: number;
  hp: number;
  maxHp: number;
  stats?: { atk: number; def: number; spe: number; spa: number; spd: number };
  moves?: readonly number[];
  pp?: readonly number[];
  ppBonuses?: number;
  /** Stage bytes as stored, 0 to 12 around a neutral 6. */
  stages?: Partial<
    Record<"atk" | "def" | "spe" | "spa" | "spd" | "acc" | "eva", number>
  >;
  ability?: number;
  types?: readonly [number, number];
  item?: number;
  status1?: number;
}

const BATTLE_MON_SIZE = 0x58;
const STAGE_AT = { atk: 1, def: 2, spe: 3, spa: 4, spd: 5, acc: 6, eva: 7 };

export function encodeBattleMon(spec: BattleMonSpec): Uint8Array {
  const out = new Uint8Array(BATTLE_MON_SIZE);
  const view = new DataView(out.buffer);
  const stats = spec.stats ?? { atk: 10, def: 10, spe: 10, spa: 10, spd: 10 };
  view.setUint16(0x00, spec.species, true);
  view.setUint16(0x02, stats.atk, true);
  view.setUint16(0x04, stats.def, true);
  view.setUint16(0x06, stats.spe, true);
  view.setUint16(0x08, stats.spa, true);
  view.setUint16(0x0a, stats.spd, true);
  (spec.moves ?? []).forEach((id, slot) => {
    view.setUint16(0x0c + slot * 2, id, true);
  });
  for (let stage = 1; stage <= 7; stage++) out[0x18 + stage] = 6;
  for (const [name, value] of Object.entries(spec.stages ?? {})) {
    out[0x18 + STAGE_AT[name as keyof typeof STAGE_AT]] = value;
  }
  out[0x20] = spec.ability ?? 0;
  out[0x21] = spec.types?.[0] ?? 0;
  out[0x22] = spec.types?.[1] ?? 0;
  (spec.pp ?? []).forEach((pp, slot) => {
    out[0x24 + slot] = pp;
  });
  view.setUint16(0x28, spec.hp, true);
  out[0x2a] = spec.level;
  view.setUint16(0x2c, spec.maxHp, true);
  view.setUint16(0x2e, spec.item ?? 0, true);
  out[0x3b] = spec.ppBonuses ?? 0;
  view.setUint32(0x4c, spec.status1 ?? 0, true);
  return out;
}

/** What one synthetic battle puts in memory. A field left out stays zero. */
export interface BattleScene {
  /** `gBattleTypeFlags`. */
  typeFlags: number;
  /** `gBattleMons` by battler position: player, opponent, partner, second opponent. */
  battlers: readonly (BattleMonSpec | undefined)[];
  /** `gBattlerPartyIndexes` by battler position. */
  partyIndexes?: readonly number[];
  enemyParty: readonly MonSpec[];
  weather?: number;
  sideStatuses?: readonly [number, number];
  spikes?: readonly [number, number];
}

/** The EWRAM offsets of the Emerald battle symbols, minus 0x02000000. */
export const BATTLE_AT = {
  typeFlags: 0x22fec,
  mons: 0x24084,
  partyIndexes: 0x2406e,
  enemyCount: 0x244ea,
  enemyParty: 0x24744,
  outcome: 0x2433a,
  weather: 0x243cc,
  sideStatuses: 0x2428e,
  sideTimers: 0x24294,
} as const;

/** `gMain` is IWRAM 0x030022c0, and `inBattle` is bit 1 of the byte at +0x439. */
export const IN_BATTLE_AT = 0x22c0 + 0x439;
const SIDE_TIMER_SIZE = 12;

export function writeBattle(
  memory: { ewram: Uint8Array; iwram: Uint8Array },
  scene: BattleScene,
): void {
  const { ewram } = memory;
  const view = new DataView(ewram.buffer, ewram.byteOffset, ewram.byteLength);
  memory.iwram[IN_BATTLE_AT] = 0x02;
  view.setUint32(BATTLE_AT.typeFlags, scene.typeFlags, true);
  scene.battlers.forEach((mon, position) => {
    if (mon) ewram.set(encodeBattleMon(mon), BATTLE_AT.mons + position * 0x58);
  });
  (scene.partyIndexes ?? []).forEach((index, position) => {
    view.setUint16(BATTLE_AT.partyIndexes + position * 2, index, true);
  });
  ewram[BATTLE_AT.enemyCount] = scene.enemyParty.length;
  ewram.set(partyBytes(scene.enemyParty.map(encodeMon)), BATTLE_AT.enemyParty);
  view.setUint16(BATTLE_AT.weather, scene.weather ?? 0, true);
  (scene.sideStatuses ?? [0, 0]).forEach((bits, side) => {
    view.setUint16(BATTLE_AT.sideStatuses + side * 2, bits, true);
  });
  (scene.spikes ?? [0, 0]).forEach((amount, side) => {
    ewram[BATTLE_AT.sideTimers + side * SIDE_TIMER_SIZE + 10] = amount;
  });
}

/** Clears the flag and sets the raw `gBattleOutcome`, as the game does when a battle ends. */
export function endBattle(
  memory: { ewram: Uint8Array; iwram: Uint8Array },
  outcome: number,
): void {
  memory.iwram[IN_BATTLE_AT] = 0;
  memory.ewram[BATTLE_AT.outcome] = outcome;
}
