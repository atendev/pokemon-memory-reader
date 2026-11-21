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
