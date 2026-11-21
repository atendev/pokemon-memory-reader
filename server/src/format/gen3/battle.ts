import type {
  BattleMove,
  Battler,
  StatStages,
  Stats,
} from "@pokemon-memory-reader/api/schemas";
import type {
  BattleField,
  BattleOutcome,
} from "@pokemon-memory-reader/api/types";
import type { Profile } from "../../profile/schema";
import type {
  BattleFrame,
  BattleTick,
  OpponentMonFrame,
} from "../../resource/battle-tracker";
import { Bytes } from "../bytes";
import { type Region, region, type Slices } from "../regions";
import {
  type BattleDecoder,
  type BattleProbe,
  type DecodeContext,
  fail,
  ok,
  type ResourceDecoder,
  type Result,
} from "../types";
import { decodePartyMon, ref, speciesTypes, status } from "./mon";
import { PARTY_MAX, PARTY_MON } from "./structs";

/** `gMain.inBattle` is bit 1 of the byte at +0x439 (pokeemerald `struct Main`). */
const IN_BATTLE = { offset: 0x439, mask: 0x02 } as const;

/** Layout of `struct BattlePokemon` (0x58 bytes, pokeemerald `include/pokemon.h`). */
const BATTLE_MON = {
  size: 0x58,
  species: 0x00,
  atk: 0x02,
  def: 0x04,
  spe: 0x06,
  spa: 0x08,
  spd: 0x0a,
  moves: 0x0c,
  statStages: 0x18,
  ability: 0x20,
  types: 0x21,
  pp: 0x24,
  hp: 0x28,
  level: 0x2a,
  maxHp: 0x2c,
  item: 0x2e,
  ppBonuses: 0x3b,
  status1: 0x4c,
} as const;

const BATTLERS = 4;
/** `gBattleMons` and `gBattlerPartyIndexes` order: player, opponent, partner (or the player's second mon), second opponent. */
const PLAYER = 0;
const OPPONENT = 1;
const PARTNER = 2;
const OPPONENT_2 = 3;

/** Stat stage bytes in `statStages`, each stored 0 to 12 around a neutral 6. */
const STAGE = {
  atk: 1,
  def: 2,
  spe: 3,
  spa: 4,
  spd: 5,
  acc: 6,
  eva: 7,
} as const;
const NEUTRAL_STAGE = 6;

/** `gBattleTypeFlags` bits (pokeemerald `include/constants/battle.h`: DOUBLE 0, TRAINER 3, MULTI 6, INGAME_PARTNER 22). Double is bit 0 alone: the game sets DOUBLE beside TWO_OPPONENTS. */
const TYPE = {
  double: 1 << 0,
  trainer: 1 << 3,
  multi: 1 << 6,
  inGamePartner: 1 << 22,
} as const;

/** `gSideStatuses` bits (pokeemerald `SIDE_STATUS_*` in `include/constants/battle.h`). */
const SIDE = {
  reflect: 0x1,
  lightScreen: 0x2,
  spikes: 0x10,
  safeguard: 0x20,
  mist: 0x100,
} as const;
/** `gSideTimers` holds one 12-byte `struct SideTimer` per side, with `spikesAmount` at +10. */
const SIDE_TIMER = { size: 12, spikesAmount: 10 } as const;

/** `gBattleWeather` bits (pokeemerald `B_WEATHER_*`): temporary, downpour and permanent rain, sandstorm, sun, hail. */
const WEATHER = {
  rain: 0x07,
  sandstorm: 0x18,
  sun: 0x60,
  hail: 0x80,
} as const;

const OUTCOME_MASK = 0x7f;
/** `B_OUTCOME_*` values mapped to the API outcome (spec §7.8). Anything else is `unknown`. */
const OUTCOMES: Readonly<Record<number, BattleOutcome>> = {
  1: "won",
  2: "lost",
  3: "drew",
  4: "ran",
  5: "ran",
  7: "caught",
  9: "forfeited",
};

/** The API outcome for a raw `gBattleOutcome`, read in the cycle the in-battle flag clears. */
export function gen3Outcome(raw: number): BattleOutcome {
  return OUTCOMES[raw & OUTCOME_MASK] ?? "unknown";
}

interface ProbeRegions {
  readonly [name: string]: Region;
  readonly flag: Region;
  readonly outcome: Region;
}

interface FrameRegions extends ProbeRegions {
  readonly typeFlags: Region;
  readonly mons: Region;
  readonly partyIndexes: Region;
  readonly enemyCount: Region;
  readonly enemyParty: Region;
  readonly weather: Region;
  readonly sideStatuses: Region;
  readonly sideTimers: Region;
}

const probeRegions = (profile: Profile<"gen3">): ProbeRegions => {
  const { gMain, gBattleOutcome } = profile.addresses;
  return {
    flag: region({ ...gMain, offset: gMain.offset + IN_BATTLE.offset }, 1),
    outcome: region(gBattleOutcome, 1),
  };
};

const frameRegions = (profile: Profile<"gen3">): FrameRegions => {
  const a = profile.addresses;
  return {
    ...probeRegions(profile),
    typeFlags: region(a.gBattleTypeFlags, 4),
    mons: region(a.gBattleMons, BATTLERS * BATTLE_MON.size),
    partyIndexes: region(a.gBattlerPartyIndexes, BATTLERS * 2),
    enemyCount: region(a.gEnemyPartyCount, 1),
    enemyParty: region(a.gEnemyParty, PARTY_MAX * PARTY_MON.size),
    weather: region(a.gBattleWeather, 2),
    sideStatuses: region(a.gSideStatuses, 4),
    sideTimers: region(a.gSideTimers, 2 * SIDE_TIMER.size),
  };
};

const flagSet = (flag: Bytes): boolean => (flag.u8(0) & IN_BATTLE.mask) !== 0;

function weather(raw: number): BattleField["weather"] {
  if (raw & WEATHER.rain) return "rain";
  if (raw & WEATHER.sandstorm) return "sandstorm";
  if (raw & WEATHER.sun) return "sun";
  if (raw & WEATHER.hail) return "hail";
  return "none";
}

function side(statuses: number, timers: Bytes, index: number) {
  const has = (bit: number) => (statuses & bit) !== 0;
  const spikesAmount = timers.u8(
    index * SIDE_TIMER.size + SIDE_TIMER.spikesAmount,
  );
  return {
    reflect: has(SIDE.reflect),
    lightScreen: has(SIDE.lightScreen),
    safeguard: has(SIDE.safeguard),
    mist: has(SIDE.mist),
    spikes: has(SIDE.spikes) ? spikesAmount : 0,
  };
}

/** A stage byte is 0 to 12 around neutral 6. A stray value clamps so the API's -6 to +6 range holds. */
const stage = (mon: Bytes, at: number): number =>
  Math.min(6, Math.max(-6, mon.u8(BATTLE_MON.statStages + at) - NEUTRAL_STAGE));

function decodeBattler(
  mon: Bytes,
  position: number,
  owner: Battler["owner"],
  partySlot: number | null,
  ctx: DecodeContext<Profile<"gen3">>,
): Battler | null {
  const speciesId = mon.u16le(BATTLE_MON.species);
  if (speciesId === 0) return null;

  const ppBonuses = mon.u8(BATTLE_MON.ppBonuses);
  const moves: BattleMove[] = [];
  for (let slot = 0; slot < 4; slot++) {
    const id = mon.u16le(BATTLE_MON.moves + slot * 2);
    if (id === 0) continue;
    const base = ctx.moveData.move(id)?.basePp;
    moves.push({
      id,
      name: ctx.names.moves(id),
      pp: mon.u8(BATTLE_MON.pp + slot),
      maxPp:
        base === undefined
          ? null
          : base + Math.floor(base / 5) * Bytes.bits(ppBonuses, slot * 2, 2),
    });
  }

  const abilityId = mon.u8(BATTLE_MON.ability);
  const itemId = mon.u16le(BATTLE_MON.item);
  const maxHp = mon.u16le(BATTLE_MON.maxHp);
  const stats: Stats = {
    hp: maxHp,
    atk: mon.u16le(BATTLE_MON.atk),
    def: mon.u16le(BATTLE_MON.def),
    spa: mon.u16le(BATTLE_MON.spa),
    spd: mon.u16le(BATTLE_MON.spd),
    spe: mon.u16le(BATTLE_MON.spe),
  };
  const statStages: StatStages = {
    atk: stage(mon, STAGE.atk),
    def: stage(mon, STAGE.def),
    spa: stage(mon, STAGE.spa),
    spd: stage(mon, STAGE.spd),
    spe: stage(mon, STAGE.spe),
    acc: stage(mon, STAGE.acc),
    eva: stage(mon, STAGE.eva),
  };

  // The struct's own types, so a Transformed mon shows the copied ones. The species table covers a struct with a type ID outside the table.
  const info = ctx.speciesData.info(speciesId);
  const structTypes = speciesTypes([
    mon.u8(BATTLE_MON.types),
    mon.u8(BATTLE_MON.types + 1),
  ]);
  const types = structTypes ?? (info ? speciesTypes(info.types) : null);

  return {
    position,
    owner,
    partySlot,
    species: {
      id: speciesId,
      dex: ctx.speciesData.dex(speciesId),
      name: ctx.names.species(speciesId),
    },
    level: mon.u8(BATTLE_MON.level),
    types,
    hp: mon.u16le(BATTLE_MON.hp),
    maxHp,
    status: status(mon.u32le(BATTLE_MON.status1)),
    ability:
      abilityId === 0 ? null : ref(abilityId, ctx.names.abilities(abilityId)),
    heldItem: itemId === 0 ? null : ref(itemId, ctx.names.items(itemId)),
    moves,
    stats,
    statStages,
  };
}

function decodeFrame(
  slices: Slices<FrameRegions>,
  ctx: DecodeContext<Profile<"gen3">>,
): Result<BattleFrame> {
  const typeFlags = slices.typeFlags.u32le(0);
  const isTrainer = (typeFlags & TYPE.trainer) !== 0;
  const isDouble = (typeFlags & TYPE.double) !== 0;
  const hasPartner =
    (typeFlags & (TYPE.multi | TYPE.inGamePartner)) !== 0 && isDouble;

  const count = slices.enemyCount.u8(0);
  if (count < 1 || count > PARTY_MAX)
    return fail(`opponent party count ${count} is outside 1 to ${PARTY_MAX}`);

  const monAt = (battler: number): Bytes =>
    slices.mons.sub(battler * BATTLE_MON.size, BATTLE_MON.size);
  const partyIndex = (battler: number): number =>
    slices.partyIndexes.u16le(battler * 2);

  if (monAt(OPPONENT).u16le(BATTLE_MON.species) === 0)
    return fail("opponent active species is 0");

  const battlers = (
    positions: readonly number[],
    owner: (position: number) => Battler["owner"],
    slot: (position: number) => number | null,
  ): Battler[] =>
    positions.flatMap((position) => {
      const battler = decodeBattler(
        monAt(position),
        position,
        owner(position),
        slot(position),
        ctx,
      );
      return battler === null ? [] : [battler];
    });

  const playerPositions = isDouble ? [PLAYER, PARTNER] : [PLAYER];
  const opponentPositions = isDouble ? [OPPONENT, OPPONENT_2] : [OPPONENT];
  const playerActive = battlers(
    playerPositions,
    (position) => (position === PARTNER && hasPartner ? "partner" : "player"),
    // A partner's mon isn't in the player's party memory, so its slot stays null until a fixture confirms it.
    (position) =>
      position === PARTNER && hasPartner ? null : partyIndex(position),
  );
  const opponentActive = battlers(
    opponentPositions,
    () => "opponent",
    partyIndex,
  );

  const onField = new Set(opponentActive.map((battler) => battler.partySlot));
  const party: OpponentMonFrame[] = [];
  for (let slot = 0; slot < count; slot++) {
    // A wild battle lists only the wild mons on the field (spec §7.8).
    if (!isTrainer && !onField.has(slot)) continue;
    const decoded = decodePartyMon(
      slices.enemyParty.sub(slot * PARTY_MON.size, PARTY_MON.size),
      ctx,
    );
    if (!decoded.ok)
      return fail(`opponent party slot ${slot}: ${decoded.reason}`);
    // `trainer` indexes `opponent.trainers`, which the trainer tables fill in a later ticket.
    party.push({ ...decoded.value, partySlot: slot, trainer: null });
  }
  if (party.length === 0) return fail("opponent party has no mon");

  const statuses = [
    slices.sideStatuses.u16le(0),
    slices.sideStatuses.u16le(2),
  ] as const;
  return ok({
    kind: isTrainer ? "trainer" : "wild",
    format: isDouble ? "double" : "single",
    modes: [],
    turn: null,
    player: { active: playerActive, partner: null },
    opponent: { active: opponentActive, party, trainers: [] },
    field: {
      weather: weather(slices.weather.u16le(0)),
      terrain: null,
      sides: {
        player: side(statuses[0], slices.sideTimers, 0),
        opponent: side(statuses[1], slices.sideTimers, 1),
      },
    },
  });
}

const probe: ResourceDecoder<Profile<"gen3">, ProbeRegions, BattleProbe> = {
  regions: probeRegions,
  decode({ flag, outcome }) {
    return ok(
      flagSet(flag)
        ? { flag: "set" }
        : { flag: "clear", outcome: gen3Outcome(outcome.u8(0)) },
    );
  },
};

const frame: ResourceDecoder<Profile<"gen3">, FrameRegions, BattleTick> = {
  regions: frameRegions,
  decode(slices, ctx) {
    if (!flagSet(slices.flag))
      return ok({
        flag: "clear",
        outcome: gen3Outcome(slices.outcome.u8(0)),
      });
    return ok({ flag: "set", frame: decodeFrame(slices, ctx) });
  },
};

/**
 * The Gen 3 and CFRU-neutral battle reader: `gMain.inBattle` as the flag, then the battle globals
 * while it is set (spec §6.4, §7.8). `gBattleOutcome` is read in the cycle the flag reads clear
 * because the globals stay stale after a battle.
 */
export const gen3Battle: BattleDecoder<Profile<"gen3">> = { probe, frame };
