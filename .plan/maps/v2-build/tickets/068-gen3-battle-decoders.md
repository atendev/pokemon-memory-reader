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
