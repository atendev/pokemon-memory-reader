---
type: research
blocked_by: []
assets: [../assets/011-battle-state-readability.md]
---

# What battle state is readable

## Question

What battle state can an adapter read for Gen 1, Gen 2, Gen 3 and CFRU, and when is it valid?

Cover the opponent's party and active mon, move PP, stat stages, field effects, trainer class, name, prize money and usable items, and the memory flags that say a battle is in progress, ended or is a wild encounter. Use the decomp symbol data from [What decomp symbol data provides](./002-decomp-symbol-data.md). The viewer's Battle screen assumes the opponent's full party (level, HP, status, held items, moves) and the trainer's details.

## Answer

Every generation exposes both active mons live (HP, status, moves, PP, stat stages) plus a clean in-battle flag: `wIsInBattle` in Gen 1, `wBattleMode` in Gen 2, and `gMain.inBattle` with `gBattleTypeFlags & BATTLE_TYPE_TRAINER` in Gen 3 and CFRU. The opponent's whole party is readable from the first turn of a trainer battle (`wEnemyMon1..6`, `wOTPartyMon1..6`, `gEnemyParty`), and only Gen 2 and Gen 3 have held items. Trainer name, class, prize money and usable items are mostly ROM lookups keyed by a trainer ID (`gTrainerBattleOpponent_A`, `wOtherTrainerID`, `wTrainerNo`), and Gen 3 prize money must be computed from the last mon's level and `gTrainerMoneyTable`. Gen 1 and Gen 2 enemy buffers share unions with wild tables and link data, and Gen 3 globals such as `gBattleTypeFlags`, `gBattleOutcome` and `gBattleMons` stay stale after a battle, so the decoder must gate every read on the in-battle flag and read the outcome on the in-battle transition. CFRU keeps vanilla FireRed addresses for the core battle globals but adds its own battle type bits, terrain and a `gNewBS` struct, and relocates `gTrainers`.

The Battle tracker data model ticket needs to settle: whether unseen opponent party members are exposed or hidden until sent out, how to represent double and two-opponent battles (battler slots, second trainer), what the `battle` resource holds after the battle ends (outcome, last snapshot, or null), how to model fields that do not exist in every generation (held items, weather, terrain, abilities) given the null rule in ticket 006, and whether trainer name, class and prize come from ROM tables the profile must locate or are left out for hacks.

