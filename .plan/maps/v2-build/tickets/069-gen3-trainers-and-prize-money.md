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

## Handoff

Branch `t3/gen3-trainers-prize-money`. Audit round 0 so far, no council yet. Context hit 155k.

**Done (wip commit):** `gTrainerBattleOpponent_A` and `_B` added to `gen3Addresses` (`server/src/format/gen3/profile.ts`) and the generator (`scripts/generate-profiles/definitions.ts`); Emerald profile regenerated (0x02038bca, 0x02038bcc).

**Facts from pret master** (pinned commit 4a73ce7 holds only the .sym): `moneyMultiplier` is at `gBattleStruct` + 0x4A (u8). `struct Trainer` is 40 bytes: class +1, name +4 (12 bytes), items u16 x4 at +0x10. Class names 13 bytes each. `gTrainerMoneyTable` is `{classId, value}` pairs ending at `0xFF` (the terminator's value is used when no class matches). `GetTrainerMoneyToGive` doubles only for DOUBLE without TWO_OPPONENTS (bit 15). The ticket text doubles every DOUBLE, so follow the game and say so in the report. In a two-opponent battle trainer B's mons sit at `gEnemyParty` slots 3 to 5, and `gEnemyPartyCount` counts all of them, so the 068 loop `slot < count` breaks when A has under 3 mons. Iterate 0 to 5 and skip all-zero slots there. Tableless flags: LINK 1, BATTLE_TOWER 8, EREADER_TRAINER 11, DOME 16, PALACE 17, ARENA 18, FACTORY 19, PIKE 20, PYRAMID 21, TOWER_LINK_MULTI 23, RECORDED_LINK 25, TRAINER_HILL 26, SECRET_BASE 27.

**Plan, in order:**
1. `format/types.ts`: `BattleExtras { moneyMultiplier }`, `TrainerFill<P> { rom(profile, frame), maxRom(profile), fill(frame, ctx, rom, extras) }`, optional `extras` and `trainers` on `BattleDecoder`. Add optional `tableDerived?: false` on `BattleFrame`.
2. New `format/gen3/trainers.ts`: ROM regions per table (`trainer:<id>` 40 bytes if id < count, `classNames`, `money`), pure `fill`, exported prize money formula. A missing table nulls only its own fields.
3. `gen3/battle.ts`: read both opponent IDs, build `trainers`, set `OpponentMon.trainer` (slot < 3 gives 0, else 1 in two-opponent), set `tableDerived`.
4. `format/registry.ts`: bind `extras` and `trainers`; add `battleRom` to `declaredRegions` and check it in `profile/registry.ts`.
5. `loop/read-loop.ts`: add the extras part to the frame read. After a valid frame, make one ROM read for names not cached (session cache, negative cache about 5 s), then `fill`, then feed the tracker.
6. Tests: synthetic ROM tables, missing tables, single, double and two-opponent money, a missing input, link/Tower/Frontier nulls, a loop test. Update battle tests and docs.
7. Council audit (Claude seat), report, commit, push, return DONE.

**Read first:** `server/src/format/gen3/battle.ts`, `server/src/loop/read-loop.ts` (cycle, feedBattle), `server/src/format/registry.ts`, `server/src/resource/battle-tracker.ts`.
