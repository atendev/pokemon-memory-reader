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

Branch `t3/gen3-trainers-prize-money-r2` (from `09447ad`). Audit round 0, no council yet. Pickup thread hit 150k.

**Done (wip commit):** all production code. `format/types.ts` (`BattleExtras`, `TrainerFill`), new `format/gen3/trainers.ts` (`gen3Trainers`, `prizeMoney`, ROM regions `trainer:<id>`/`classNames`/`money`, pure `fill`), `gen3/battle.ts` (opponent IDs, `Trainer` placeholders, `OpponentMon.trainer`, `tableDerived:false` for tableless types, two-opponent slot loop 0..5 skipping zero slots), `format/registry.ts` (`BoundTrainers`, `declaredRegions().rom`, `battleExtras` part), `profile/registry.ts` (caps check of `rom`), `loop/read-loop.ts` (extras part in the frame batch, per-session ROM cache with 5 s retry, `feedBattle` async fill), `battle-tracker.ts` (`tableDerived`). Existing tests updated; `bun test server` passes except the Lua core test (no Lua here, not mine). `bun install` was run in this worktree.

**Left, in order:**
1. Tests (none written yet). `server/test/gen3/trainers.test.ts` on synthetic ROM bytes: entry decode (class, name, items), each table missing nulls only its fields, id at or past `count`, money value and terminator fallback, `prizeMoney` single/double/two-opponent (A and B each own amount, no doubling in two-opponent)/missing input, link/Tower/Frontier give null table fields. Battle decoder test for two-opponent slots (A has 2 mons, B at 3 to 5) and `trainer` indexes. Loop test with a ROM served trainer table (fake adapter ROM is 0x400 bytes, so place tables at small offsets via a test profile) including cached second read.
2. Docs: `.describe()` for `Trainer.items`/prize money, mention that double battles with two opponents are not doubled (follows `GetTrainerMoneyToGive`, differs from ticket text, say so in the report). Check `api/src/schemas.ts`.
3. `bun run typecheck`, `bunx biome check --write .`, `bun test server`.
4. Council audit (Claude seat only, other seats `n/a`), decision report to `.plan/maps/v2-build/assets/069-gen3-trainers-and-prize-money-report.md` (unslop), `wf-time.py close`, record resolution in ticket (delete this section), commit, push (no force), PR against `wayfinder/v2-build-master` if the repo uses PRs, return DONE.

**Read first:** `server/src/format/gen3/trainers.ts`, `server/src/loop/read-loop.ts` (`readTrainerRom`, `feedBattle`, `cycle`).
