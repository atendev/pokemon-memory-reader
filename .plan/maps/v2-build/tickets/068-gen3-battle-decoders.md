---
type: task
blocked_by: [062, 067]
claimed_by: wfm-v2-build-master-1795256075
claimed_at: 2026-11-21T10:25:54Z
---

# Gen 3 battle decoders and the `battle` resource

## What to build

Feed the tracker from Emerald, following spec §7.8, §6.4 and [the 015 amendment](../assets/015-battle-modes-enum.md). Read `gMain.inBattle` as the flag, then `gBattleTypeFlags` (trainer is bit 3, double is bit 0), `gBattleMons` for battlers (species, level, types, HP, status, ability, held item, moves with PP, stats and stat stages), `gBattlerPartyIndexes` for `partySlot`, `gEnemyParty` for the opponent party, weather and side conditions for `field`, and `gBattleOutcome` on the transition (mask `0x7F`, mapping in §7.8). Stat stages normalise to -6 to +6. Addresses come from pret symbols through the generator, in a profile `battle` block.

`modes` ships as an empty array until each value's fixture lands (015), `turn` is null, and partner `partySlot` is null until a fixture confirms it. Trainers and prize money are the next ticket, so `trainers` is empty for now. `GET /api/v2/battle` and the `battle` topic join the app.

## Acceptance criteria

- `GET /api/v2/battle` returns the inactive shape with `lastBattle: null` out of battle, and a valid active shape in a synthetic single wild battle and a synthetic double trainer battle.
- The outcome mapping is tested for every value in §7.8, including an unknown value.
- The battle is read while no client subscribes, so `lastBattle` is complete (spec §8.2).
- The Emerald profile gains its `battle` block from the generator with a stable second run.

## Resolution

`gen3Battle` in `server/src/format/gen3/battle.ts` reads `gMain.inBattle` and `gBattleOutcome` every tick, and the whole frame (`gBattleTypeFlags`, `gBattleMons`, `gBattlerPartyIndexes`, `gEnemyParty`, weather, side statuses and timers) while the flag is set. `battle` joins `TOPIC_NAMES`, `ResourceMap`, `resourceSchemas` and the app, so `GET /api/v2/battle` works. The read loop reads the flag with no client, so `lastBattle` is complete when first asked. The Emerald profile gained six battle symbols in `addresses` from the generator, and a second generator run is byte-identical. Double is bit 0 alone. Open question: `gSideTimers` is read at 12 bytes per side, while pret master lists 11 members. Report: [068 report](../assets/068-gen3-battle-decoders-report.md). Claude seat only, approved in round 3 at 8. Gemini and GPT seats skipped (out of quota).

Timing: wall 17m, active 15m, user 0s, wait 58s, blocked 0s | implement 11m, audit 3m (3 rounds), gate 31s | tools 132 (9 subagent) | limits 0, compactions 0, handoffs 2 | ctx peak 156k | cost $4.87 sonnet-5-5 + $0.03 haiku-5-5
