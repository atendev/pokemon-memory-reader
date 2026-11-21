---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795256075
claimed_at: 2026-11-21T10:15:08Z
---

# Battle tracker core and `battle` schema

## What to build

Build the one battle tracker that sits between decoders and the API ([interfaces 004](../assets/004-core-module-interfaces.md)), as a pure module with no emulator I/O, following spec §7.8 (first half), §6.4, [the 015 amendment](../assets/015-battle-modes-enum.md) and [the 025 amendment](../assets/025-spec-text-mismatches.md).

It takes per-tick frames (in-battle flag, validation result, decoded snapshot) and owns: going active only when the flag is set and the data validates; holding the last valid state with no timer while validation fails; going inactive as soon as the flag clears with the outcome read on that transition; `battleId` and its reset rules (game change or restart, not a reconnect to the same game); freezing `lastBattle` from the last valid active snapshot; the `revealed` rules; one de-duplicated warning per battle; and the warning after 2 s of failing validation per flag-set period (025). Gen 1 `0xFF` ends the battle as `unknown` per 025. The `battle` union and `LastBattle` types follow the API sync rules, and `modes` follows 015 with its meaning records.

## Acceptance criteria

- A test feeds an invalid frame sequence while the flag is set and asserts the resource doesn't flip and nothing is emitted.
- Tests cover `battleId` increments and resets, `lastBattle` being null while active, and the reconnect case that doesn't double-log.
- Tests cover `revealed` (slot listed, HP below max, wild always revealed) and the warning rules.
- The `battle` types, schema and sync tests are in place.

## Handoff

Branch `t3/battle-tracker-core-schema`, WIP sha f804aed. Council audit rounds used: 0. Context hit 150k before the first dispatch.

Done (typecheck, lint and tests green; the only failing test is the Lua 5.3/5.4 version check, because the host's default `lua` is 5.5, unrelated):
- `api/src/types.ts`, `schemas.ts`: Battle, ActiveBattle, InactiveBattle, LastBattle, Battler, BattleMove, Trainer, OpponentMon, SideConditions, StatStages, BattleMode (open), BATTLE_KINDS/FORMATS/OUTCOMES.
- `api/src/meanings.ts`: empty `BATTLE_MODES` record in `OPEN_ENUMS.battleMode`; docs, renderer and open-enums test allow an empty record.
- `api/src/sync.test.ts` pairs; `schemas.test.ts` closed-enum walker now handles unions and walks `Battle` (snapshot gained 361 added lines, no removals).
- `server/src/resource/battle-tracker.ts` (pure tracker, `BattleTick` = set/clear/ended) with `server/test/resource/battle-tracker.test.ts` (28 tests) and `server/test/support/battle-frames.ts`.

Decisions to record: topic `battle` NOT added to `TOPIC_NAMES`/`ResourceMap`/`resourceSchemas` (068 does it with the route). Invalid read before anything was served emits the inactive shape once, then nothing. `classId` nullable, `Trainer.items` is `Ref[] | null`, `Battler.stats` non-null. HP below max is sticky for `revealed`. Gen 1 `ended` tick maps to `GEN1_END_MARKER_OUTCOME = "unknown"`.

Left, in order:
1. Run the council audit, Claude seat only (haiku, `run_in_background: false`), with the Gemini and GPT seats skipped (out of quota). Round 1. Fix problems, up to 5 rounds.
2. Write `.plan/maps/v2-build/assets/067-battle-tracker-core-report.md`, run unslop on it.
3. Run the Timing close (`wf-time.py close --slug v2-build --ticket 067 ...`), delete this Handoff section, add the resolution to the ticket file, commit (no co-author), push without force, open a PR against `wayfinder/v2-build-master` and link it, return DONE.

Read first: `server/src/resource/battle-tracker.ts`, `api/src/types.ts` (end of file), `api/src/schemas.ts` (battle block).
