---
type: task
blocked_by: [068]
claimed_by: wfm-v2-build-master-1795260524
claimed_at: 2026-11-21T11:40:00Z
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

## Resolution

`gen3Trainers` (`server/src/format/gen3/trainers.ts`) fills `opponent.trainers` and `LastBattle.trainers` for Emerald. The frame decoder lists each trainer with null table fields, reading `gTrainerBattleOpponent_A` and `_B`. The read loop then reads `gTrainers`, `gTrainerClassNames` and `gTrainerMoneyTable` from ROM once per session (a failed read retries after 5 seconds), and the pure `fill` sets class, class name, name, starting items and prize money. A missing table nulls only its own fields, and `gBattleStruct->moneyMultiplier` (offset 0x4a) is its own read part, so an unreadable struct nulls only the money. Link, Tower, Frontier, e-Reader, Trainer Hill and secret base battles give null table fields and read no ROM. A two-opponent battle lists trainers A and B and splits the party at slot 3. No ROM bytes are committed.

Prize money follows pokeemerald `GetTrainerMoneyToGive`: a double battle against one trainer is doubled, but a two-opponent battle pays each trainer its own undoubled amount. That differs from the ticket and spec §7.8 text, which say to double whenever `BATTLE_TYPE_DOUBLE` is set. The spec text needs a fix.

Council: Claude seat APPROVE 8/10 in round 1, Gemini and GPT `n/a` (out of quota). Report: [069 report](../assets/069-gen3-trainers-and-prize-money-report.md).

Timing: wall 16m, active 16m, user 0s, wait 0s, blocked 0s | setup 5m, implement 8m, audit 1m (1 round) | tools 127 (2 subagent) | limits 0, compactions 0, handoffs 2 | ctx peak 158k | cost $4.64 sonnet-5-5 + $0.01 haiku-5-5
