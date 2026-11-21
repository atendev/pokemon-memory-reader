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

## Resolution

`battleTracker` in `server/src/resource/battle-tracker.ts` is a pure fold over `set`, `clear` and `ended` ticks. It goes active only on a set flag with a valid frame, holds the last valid state with no timer while validation fails, and goes inactive on the tick the flag clears, freezing `lastBattle` with the outcome read in that cycle. `battleId` counts battles from 0 and resets only through `initial()`, which the loop calls for a game change or restart, so a reconnect keeps the id and freezes one `lastBattle`. `revealed` marks slots listed as an opponent `partySlot` or with HP below max, sticky for the battle, and every wild mon is revealed. One warning fires after 2 s of failing validation per flag-set period (025), and the Gen 1 `0xFF` end marker maps to `unknown` through `GEN1_END_MARKER_OUTCOME`. An invalid read before anything was served emits the inactive shape once, then nothing. The `battle` union, `LastBattle`, the open `BattleMode` with an empty `BATTLE_MODES` meaning record, schemas and sync tests are in `api/`. The `battle` topic is not yet in `TOPIC_NAMES`, `ResourceMap` or `resourceSchemas`, because [Gen 3 battle decoders](./068-gen3-battle-decoders.md) adds it with the `GET /api/v2/battle` route. Audit approved in round 2 (Claude seat only, 8 then 9; Gemini and GPT seats skipped, out of quota). CI is not run per ticket. The decision report is `../assets/067-battle-tracker-core-report.md`. The Lua 5.3/5.4 version test in `core.test.ts` still fails because the host's `lua` is 5.5, unrelated.

Timing: wall 8m, active 8m, user 0s, wait 0s, blocked 0s | implement 5m, audit 2m (2 rounds) | tools 71 (6 subagent) | limits 0, compactions 0, handoffs 1 | ctx peak 155k | cost $2.48 sonnet-5-5 + $0.02 haiku-5-5
