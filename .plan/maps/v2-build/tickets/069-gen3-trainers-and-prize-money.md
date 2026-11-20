---
type: task
blocked_by: [068]
---

# Gen 3 trainers and prize money

## What to build

Fill `opponent.trainers` and `LastBattle.trainers` for Emerald, following spec §7.8 (`Trainer`) and the `trainerTables` entries (`{ base, count }`) from [the 018 amendment](../assets/018-profile-schema-remainder.md). `Trainer` is `{ id, classId, className, name, prizeMoney, items }`. Fields come from the profile's optional ROM tables, and a missing table nulls the dependent fields. In fixture tests the tables count as missing (§12.2), so those fields decode to null.

`prizeMoney` for Gen 3 is `4 * lastMonLevel * gBattleStruct->moneyMultiplier * gTrainerMoneyTable[classId].value`, doubled when `BATTLE_TYPE_DOUBLE` is set, with each trainer in a two-opponent battle getting its own amount. It is null when any input is missing or `gBattleStruct` can't be read, and Pay Day money is not included. `items` is the starting list in Gen 3.

## Acceptance criteria

- Trainer fields decode from a synthetic ROM table, and each dependent field is null when its table is missing.
- The prize money formula is tested for a single, a double and a two-opponent battle, and for a missing input.
- Link, Tower and Frontier battles give null table-derived fields.
- No ROM bytes are committed.
