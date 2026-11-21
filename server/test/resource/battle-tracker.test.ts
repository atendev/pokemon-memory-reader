import { describe, expect, test } from "bun:test";
import type { Battle as BattleResource } from "@pokemon-memory-reader/api/schemas";
import { Battle } from "@pokemon-memory-reader/api/schemas";
import { fail, ok } from "../../src/format/types";
import {
  type BattleFrame,
  type BattleTick,
  type BattleTrackerState,
  battleTracker,
  GEN1_END_MARKER_OUTCOME,
  VALIDATION_WARNING_MS,
} from "../../src/resource/battle-tracker";
import {
  battler,
  opponentMon,
  trainerFrame,
  wildFrame,
} from "../support/battle-frames";

const valid = (frame: BattleFrame = trainerFrame()): BattleTick => ({
  flag: "set",
  frame: ok(frame),
});
const invalid = (reason = "no opponent species"): BattleTick => ({
  flag: "set",
  frame: fail(reason),
});
const clear = (outcome: "won" | "lost" = "won"): BattleTick => ({
  flag: "clear",
  outcome,
});

/** Feeds `ticks` at one tick per `stepMs` from `start` and returns the state and every step's output. */
function run(
  ticks: readonly BattleTick[],
  from: BattleTrackerState = battleTracker.initial(),
  start = 1_000_000,
  stepMs = 100,
) {
  let state = from;
  const outputs: { value: BattleResource | null; warnings: string[] }[] = [];
  ticks.forEach((tick, index) => {
    const result = battleTracker.step(state, tick, start + index * stepMs);
    state = result.state;
    outputs.push({ value: result.value, warnings: [...result.warnings] });
  });
  return { state, outputs };
}
/** A state that has already served the inactive shape. */
const idle = () => run([clear()]).state;

describe("going active and inactive", () => {
  test("a clear flag from the start serves the inactive shape with no lastBattle", () => {
    const { outputs } = run([clear()]);
    expect(outputs[0]?.value).toEqual({ active: false, lastBattle: null });
  });

  test("a set flag with valid data goes active with battleId 1", () => {
    const { outputs } = run([valid()], idle());
    const value = outputs[0]?.value;
    expect(value).toMatchObject({
      active: true,
      battleId: 1,
      kind: "trainer",
      format: "single",
    });
    expect(Battle.safeParse(value).success).toBe(true);
  });

  test("lastBattle is never carried while a battle is active", () => {
    const { outputs } = run([valid(), clear(), valid(), valid()], idle());
    const second = outputs[2]?.value;
    expect(second).toMatchObject({ active: true, battleId: 2 });
    expect(second).not.toHaveProperty("lastBattle");
    expect(outputs[3]?.value).not.toHaveProperty("lastBattle");
  });

  test("the flag clearing goes inactive and freezes lastBattle from the last valid frame", () => {
    const first = trainerFrame({ modes: ["b_mode", "a_mode", "a_mode"] });
    const last = trainerFrame({
      modes: ["b_mode", "a_mode"],
      opponent: {
        active: [battler("opponent", 0)],
        party: [
          opponentMon(0, { trainer: 0, hp: 3 }),
          opponentMon(1, { trainer: 0 }),
        ],
        trainers: [],
      },
    });
    const { outputs } = run(
      [valid(first), valid(last), invalid(), clear("lost")],
      idle(),
      Date.UTC(2026, 10, 21, 12, 0, 0),
      1000,
    );
    const ended = outputs[3]?.value;
    expect(ended).toMatchObject({
      active: false,
      lastBattle: {
        battleId: 1,
        outcome: "lost",
        endedAt: "2026-11-21T12:00:03.000Z",
        kind: "trainer",
        format: "single",
        modes: ["a_mode", "b_mode"],
        trainers: [],
      },
    });
    const party = (ended as { lastBattle: { opponentParty: unknown[] } })
      .lastBattle.opponentParty;
    expect(party).toHaveLength(2);
    expect(Battle.safeParse(ended).success).toBe(true);
  });

  test("a clear flag with no valid battle in between creates no lastBattle", () => {
    const { outputs } = run([invalid(), invalid(), clear("won")], idle());
    expect(outputs[2]?.value).toEqual({ active: false, lastBattle: null });
  });

  test("the Gen 1 0xFF end marker ends the battle with outcome unknown", () => {
    const { outputs, state } = run([valid(), { flag: "ended" }], idle());
    expect(GEN1_END_MARKER_OUTCOME).toBe("unknown");
    expect(outputs[1]?.value).toMatchObject({
      active: false,
      lastBattle: { battleId: 1, outcome: "unknown" },
    });
    expect(state.active).toBeNull();
  });
});

describe("invalid frames while the flag is set", () => {
  test("never flip the resource and emit nothing after an inactive value was served", () => {
    const { outputs, state } = run(
      [invalid(), invalid(), invalid(), invalid()],
      idle(),
    );
    expect(outputs.map((o) => o.value)).toEqual([null, null, null, null]);
    expect(state.active).toBeNull();
    expect(state.battleId).toBe(0);
  });

  test("hold the last valid active state and emit nothing", () => {
    const { outputs, state } = run([valid(), invalid(), invalid()], idle());
    expect(outputs[0]?.value).toMatchObject({ active: true, battleId: 1 });
    expect(outputs[1]?.value).toBeNull();
    expect(outputs[2]?.value).toBeNull();
    expect(state.active).toMatchObject({ active: true, battleId: 1 });
  });

  test("a valid frame after invalid ones continues the same battle", () => {
    const { outputs } = run([valid(), invalid(), valid()], idle());
    expect(outputs[2]?.value).toMatchObject({ active: true, battleId: 1 });
  });

  test("before anything was served, the inactive shape goes out once and then nothing", () => {
    const { outputs } = run([invalid(), invalid(), invalid()]);
    expect(outputs[0]?.value).toEqual({ active: false, lastBattle: null });
    expect(outputs[1]?.value).toBeNull();
    expect(outputs[2]?.value).toBeNull();
  });
});

describe("battleId and reconnects", () => {
  test("increments each time a battle goes active", () => {
    const { outputs } = run(
      [valid(), clear(), valid(), clear(), valid()],
      idle(),
    );
    const ids = outputs.map((o) => (o.value?.active ? o.value.battleId : null));
    expect(ids).toEqual([1, null, 2, null, 3]);
  });

  test("each lastBattle carries the id of its own battle", () => {
    const { outputs } = run([valid(), clear(), valid(), clear()], idle());
    expect(outputs[1]?.value).toMatchObject({ lastBattle: { battleId: 1 } });
    expect(outputs[3]?.value).toMatchObject({ lastBattle: { battleId: 2 } });
  });

  test("a new game starts again at 0 with lastBattle null", () => {
    const afterBattle = run([valid(), clear()], idle()).state;
    expect(afterBattle.lastBattle).not.toBeNull();
    const fresh = battleTracker.initial();
    expect(fresh.battleId).toBe(0);
    expect(fresh.lastBattle).toBeNull();
    const { outputs } = run([clear(), valid()], fresh);
    expect(outputs[0]?.value).toEqual({ active: false, lastBattle: null });
    expect(outputs[1]?.value).toMatchObject({ active: true, battleId: 1 });
  });

  test("a reconnect to the same game mid-battle keeps the id and freezes one lastBattle for the encounter", () => {
    const before = run([valid(), valid()], idle()).state;
    // The adapter drops and reconnects: the loop keeps the state and sends no ticks in the gap.
    const { outputs } = run([valid(), valid(), clear("won"), valid()], before);
    const frozen = outputs.filter(
      (o) => o.value !== null && !o.value.active && o.value.lastBattle,
    );
    expect(frozen).toHaveLength(1);
    expect(outputs[0]?.value).toMatchObject({ active: true, battleId: 1 });
    expect(outputs[1]?.value).toMatchObject({ active: true, battleId: 1 });
    expect(outputs[2]?.value).toMatchObject({
      active: false,
      lastBattle: { battleId: 1, outcome: "won" },
    });
    expect(outputs[3]?.value).toMatchObject({ active: true, battleId: 2 });
  });
});

describe("revealed", () => {
  const revealedSlots = (value: BattleResource | null) =>
    value?.active ? value.opponent.party.map((mon) => mon.revealed) : null;

  test("a slot listed as an opponent battler's partySlot is revealed, the rest are not", () => {
    const { outputs } = run([valid()], idle());
    expect(revealedSlots(outputs[0]?.value ?? null)).toEqual([
      true,
      false,
      false,
    ]);
  });

  test("a mon with HP below max counts as revealed", () => {
    const frame = trainerFrame({
      opponent: {
        active: [battler("opponent", 0)],
        party: [
          opponentMon(0, { trainer: 0 }),
          opponentMon(1, { trainer: 0, hp: 7 }),
          opponentMon(2, { trainer: 0 }),
        ],
        trainers: [],
      },
    });
    const { outputs } = run([valid(frame)], idle());
    expect(revealedSlots(outputs[0]?.value ?? null)).toEqual([
      true,
      true,
      false,
    ]);
  });

  test("a revealed mon stays revealed after it leaves the field", () => {
    const switched = trainerFrame({
      opponent: {
        active: [battler("opponent", 1)],
        party: trainerFrame().opponent.party,
        trainers: [],
      },
    });
    const { outputs } = run([valid(), valid(switched)], idle());
    expect(revealedSlots(outputs[1]?.value ?? null)).toEqual([
      true,
      true,
      false,
    ]);
  });

  test("revealed clears when the next battle starts", () => {
    const hidden = trainerFrame({
      opponent: {
        active: [battler("opponent", 2)],
        party: trainerFrame().opponent.party,
        trainers: [],
      },
    });
    const { outputs } = run([valid(), clear(), valid(hidden)], idle());
    expect(revealedSlots(outputs[2]?.value ?? null)).toEqual([
      false,
      false,
      true,
    ]);
  });

  test("a wild mon is always revealed", () => {
    const frame = wildFrame({
      opponent: {
        active: [],
        party: [opponentMon(0), opponentMon(1)],
        trainers: [],
      },
    });
    const { outputs } = run([valid(frame)], idle());
    expect(revealedSlots(outputs[0]?.value ?? null)).toEqual([true, true]);
  });

  test("lastBattle keeps the revealed flags the battle ended with", () => {
    const { outputs } = run([valid(), clear()], idle());
    const ended = outputs[1]?.value;
    const lastBattle = ended?.active === false ? ended.lastBattle : null;
    expect(lastBattle?.opponentParty.map((mon) => mon.revealed)).toEqual([
      true,
      false,
      false,
    ]);
  });
});

describe("modes", () => {
  test("are unique and sorted in code-point order", () => {
    const { outputs } = run(
      [valid(trainerFrame({ modes: ["roamer", "legendary", "roamer"] }))],
      idle(),
    );
    expect(outputs[0]?.value).toMatchObject({
      modes: ["legendary", "roamer"],
    });
  });

  test("order astral characters after the basic plane, not by UTF-16 unit", () => {
    const { outputs } = run(
      [valid(trainerFrame({ modes: ["\u{1F600}", "Ａ"] }))],
      idle(),
    );
    expect(outputs[0]?.value).toMatchObject({ modes: ["Ａ", "\u{1F600}"] });
  });
});

describe("the validation warning", () => {
  const warnings = (outputs: { warnings: string[] }[]) =>
    outputs.flatMap((o) => o.warnings);

  test("fires once after 2 s of consecutive failures with the flag set", () => {
    const { outputs } = run(
      [invalid(), invalid(), invalid(), invalid()],
      idle(),
      0,
      VALIDATION_WARNING_MS / 2,
    );
    // Failures at 0, 1000, 2000 and 3000 ms: the first run of 2 s ends at the third read.
    expect(outputs.map((o) => o.warnings.length)).toEqual([0, 0, 1, 0]);
    expect(warnings(outputs)[0]).toContain("no opponent species");
  });

  test("stays quiet under 2 s", () => {
    const { outputs } = run([invalid(), invalid(), invalid()], idle(), 0, 900);
    expect(warnings(outputs)).toEqual([]);
  });

  test("a valid read resets the 2 s clock", () => {
    const { outputs } = run(
      [invalid(), invalid(), valid(), invalid(), invalid()],
      idle(),
      0,
      1000,
    );
    // Failures at 0 and 1000, a valid read at 2000, failures at 3000 and 4000: neither run lasts 2 s.
    expect(warnings(outputs)).toEqual([]);
  });

  test("at most one per flag-set period, even after a valid read", () => {
    const { outputs } = run(
      [
        invalid(),
        invalid(),
        invalid(),
        valid(),
        invalid(),
        invalid(),
        invalid(),
      ],
      idle(),
      0,
      1000,
    );
    expect(warnings(outputs)).toHaveLength(1);
  });

  test("a new flag-set period can warn again", () => {
    const failing = [invalid(), invalid(), invalid()];
    const { outputs } = run([...failing, clear(), ...failing], idle(), 0, 1000);
    expect(warnings(outputs)).toHaveLength(2);
  });

  test("applies while a battle is already active, and the held state still emits nothing", () => {
    const { outputs, state } = run(
      [valid(), invalid(), invalid(), invalid()],
      idle(),
      0,
      1000,
    );
    expect(warnings(outputs)).toHaveLength(1);
    expect(outputs.slice(1).map((o) => o.value)).toEqual([null, null, null]);
    expect(state.active).toMatchObject({ active: true, battleId: 1 });
  });

  test("the flag clearing ends the period without a warning", () => {
    const { outputs } = run([invalid(), invalid(), clear()], idle(), 0, 1500);
    expect(warnings(outputs)).toEqual([]);
  });
});
