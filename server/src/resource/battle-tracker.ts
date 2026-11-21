import type {
  ActiveBattle,
  Battle,
  Battler,
  LastBattle,
  OpponentMon,
  Pokemon,
  Trainer,
} from "@pokemon-memory-reader/api/schemas";
import type {
  BattleField,
  BattleMode,
  BattleOutcome,
} from "@pokemon-memory-reader/api/types";
import type { Result } from "../format/types";

/** Folds decoded inputs into a value with program-tracked fields. `value: null` emits nothing (spec §7.8). */
export interface Tracker<In, Out, S> {
  initial(): S;
  step(
    state: S,
    input: In,
    now: number,
  ): {
    readonly state: S;
    readonly value: Out | null;
    /** Log lines the caller writes at warn level. The tracker does no I/O. */
    readonly warnings: readonly string[];
  };
}

/** An opponent party mon as a decoder returns it: the tracker adds `revealed`. */
export type OpponentMonFrame = Pokemon & {
  partySlot: number;
  trainer: number | null;
};

/**
 * A decoded snapshot of one valid battle read, before the fields the program tracks (`battleId`,
 * `revealed`, `lastBattle`). Every generation's decoder returns this one shape (interfaces 004).
 */
export interface BattleFrame {
  readonly kind: ActiveBattle["kind"];
  readonly format: ActiveBattle["format"];
  readonly modes: readonly BattleMode[];
  readonly turn: number | null;
  readonly player: {
    readonly active: readonly Battler[];
    readonly partner: Trainer | null;
  };
  readonly opponent: {
    readonly active: readonly Battler[];
    readonly party: readonly OpponentMonFrame[];
    readonly trainers: readonly Trainer[];
  };
  readonly field: BattleField;
}

/**
 * One read cycle's battle input. `set` carries the decoder's validation result: a frame needs a
 * non-zero opponent active species and a party count from 1 to 6 (spec §7.8). `clear` carries the
 * outcome, which the decoder reads in the same cycle the flag reads clear (spec §6.4, so stale
 * globals don't leak in). `ended` is the Gen 1 `wIsInBattle == 0xFF` end marker (amendment 025
 * item 4).
 */
export type BattleTick =
  | { readonly flag: "set"; readonly frame: Result<BattleFrame> }
  | { readonly flag: "clear"; readonly outcome: BattleOutcome }
  | { readonly flag: "ended" };

/**
 * The outcome the Gen 1 end marker gives until its fixture confirms a known loss (amendment 025
 * item 4). When that fixture lands this becomes `"lost"`.
 */
export const GEN1_END_MARKER_OUTCOME: BattleOutcome = "unknown";

/** Consecutive failing reads with the flag set before the one warning (amendment 025 item 2). */
export const VALIDATION_WARNING_MS = 2000;

export interface BattleTrackerState {
  /** Counts battles gone active. 0 until the first. Reset by `initial()` on a game change (spec §7.8). */
  readonly battleId: number;
  /** The last valid active value. It is held while validation fails and null while inactive. */
  readonly active: ActiveBattle | null;
  /** Opponent party slots revealed in the current battle. Empty while inactive. */
  readonly revealed: ReadonlySet<number>;
  /** Never carried on the active shape. Replaced when a battle ends. */
  readonly lastBattle: LastBattle | null;
  /** True once the resource has emitted, so a first invalid read still serves the inactive shape. */
  readonly emitted: boolean;
  /** When the current run of failing reads began, in the caller's clock. */
  readonly failingSince: number | null;
  /** True once this flag-set period has warned. The period ends when the flag reads clear. */
  readonly warned: boolean;
}

function byCodePoint(a: string, b: string): number {
  const left = Array.from(a, (ch) => ch.codePointAt(0) ?? 0);
  const right = Array.from(b, (ch) => ch.codePointAt(0) ?? 0);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return left.length - right.length;
}

/** Unique and sorted, so reordered or repeated tags never look like a change (amendment 015 item 6). */
function normalizeModes(modes: readonly BattleMode[]): BattleMode[] {
  return [...new Set(modes)].sort(byCodePoint);
}

/**
 * A trainer mon counts as revealed once any valid frame lists its slot as an opponent battler's
 * `partySlot`, or its HP is below max (a mon sent out before the program attached). It stays
 * revealed for the battle.
 */
function revealedSlots(
  previous: ReadonlySet<number>,
  frame: BattleFrame,
): Set<number> {
  const next = new Set(previous);
  for (const battler of frame.opponent.active) {
    if (battler.partySlot !== null) next.add(battler.partySlot);
  }
  for (const mon of frame.opponent.party) {
    if (mon.hp !== null && mon.maxHp !== null && mon.hp < mon.maxHp) {
      next.add(mon.partySlot);
    }
  }
  return next;
}

function activeValue(
  battleId: number,
  frame: BattleFrame,
  revealed: ReadonlySet<number>,
): ActiveBattle {
  return {
    active: true,
    battleId,
    kind: frame.kind,
    format: frame.format,
    modes: normalizeModes(frame.modes),
    turn: frame.turn,
    player: {
      active: [...frame.player.active],
      partner: frame.player.partner,
    },
    opponent: {
      active: [...frame.opponent.active],
      party: frame.opponent.party.map(
        (mon): OpponentMon => ({
          ...mon,
          revealed: frame.kind === "wild" || revealed.has(mon.partySlot),
        }),
      ),
      trainers: [...frame.opponent.trainers],
    },
    field: frame.field,
  };
}

function freeze(
  battle: ActiveBattle,
  outcome: BattleOutcome,
  now: number,
): LastBattle {
  return {
    battleId: battle.battleId,
    outcome,
    endedAt: new Date(now).toISOString(),
    kind: battle.kind,
    format: battle.format,
    modes: battle.modes,
    trainers: battle.opponent.trainers,
    opponentParty: battle.opponent.party,
  };
}

function inactiveValue(lastBattle: LastBattle | null): Battle {
  return { active: false, lastBattle };
}

/**
 * The one battle tracker, between the per-format decoders and the API (spec §7.8, §6.4, amendments
 * 015 and 025). A pure fold with no emulator I/O. It owns the active flip, `battleId`, `lastBattle`,
 * `revealed` and the validation warning, so every format gets them the same way.
 *
 * The loop calls `initial()` for a new game or a restart and keeps the state across an adapter
 * reconnect to the same game, so a reconnect mid-battle neither bumps `battleId` nor logs the
 * encounter twice.
 */
export const battleTracker: Tracker<BattleTick, Battle, BattleTrackerState> = {
  initial: () => ({
    battleId: 0,
    active: null,
    revealed: new Set(),
    lastBattle: null,
    emitted: false,
    failingSince: null,
    warned: false,
  }),

  step(state, tick, now) {
    if (tick.flag !== "set") {
      const outcome =
        tick.flag === "ended" ? GEN1_END_MARKER_OUTCOME : tick.outcome;
      const lastBattle =
        state.active === null
          ? state.lastBattle
          : freeze(state.active, outcome, now);
      return {
        state: {
          ...state,
          active: null,
          revealed: new Set(),
          lastBattle,
          emitted: true,
          failingSince: null,
          warned: false,
        },
        value: inactiveValue(lastBattle),
        warnings: [],
      };
    }

    if (tick.frame.ok) {
      const frame = tick.frame.value;
      const battleId =
        state.active === null ? state.battleId + 1 : state.battleId;
      const revealed = revealedSlots(
        state.active === null ? new Set() : state.revealed,
        frame,
      );
      const active = activeValue(battleId, frame, revealed);
      return {
        state: {
          ...state,
          battleId,
          active,
          revealed,
          emitted: true,
          failingSince: null,
        },
        value: active,
        warnings: [],
      };
    }

    // The flag is set and validation failed. Hold the last valid state and emit nothing, apart from
    // the inactive shape before anything was served. The clock only drives the one warning.
    const failingSince = state.failingSince ?? now;
    const warn = !state.warned && now - failingSince >= VALIDATION_WARNING_MS;
    return {
      state: {
        ...state,
        emitted: true,
        failingSince,
        warned: state.warned || warn,
      },
      value: state.emitted ? null : inactiveValue(state.lastBattle),
      warnings: warn
        ? [
            `Battle data has failed validation for ${VALIDATION_WARNING_MS / 1000} s while the in-battle flag is set: ${tick.frame.reason}`,
          ]
        : [],
    };
  },
};
