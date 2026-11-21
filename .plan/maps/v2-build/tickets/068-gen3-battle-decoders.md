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

## Handoff

Branch `t3/gen3-battle-decoders-1` (cut from `fded0b9`), SHA is the commit that adds this section (wip: slice 2). Attempt 2, audit round 0, no council yet.

**Done.**
- Slice 1 (`ae4d348`): Emerald `addresses` gain `gMain`, `gBattlerPartyIndexes`, `gBattleOutcome`, `gBattleWeather`, `gSideStatuses`, `gSideTimers`. The "battle block" is these keys, not a new profile key (put that in the report).
- Slice 2 (this commit): `server/src/format/gen3/battle.ts` (`gen3Battle` with `probe` = flag + outcome and `frame`, `gen3Outcome`), `BattleDecoder`/`BattleProbe` in `format/types.ts`, `BoundBattle` and `declaredRegions` in `format/registry.ts`, `battle` in `TOPIC_NAMES`, `ResourceMap`, `resourceSchemas`, `SNAPSHOT_TOPICS`, `docs/open-enums.md` regenerated, and the read loop (`readParts`, `feedBattle`, `Session.battle`/`battleOn`, flag read every tick, frame read while set, immediate second request when the probe reads set). Typecheck passes. `bun test`: 635 pass, 6 fail.
- Verified against pret: BattlePokemon layout incl. `ppBonuses` 0x3B and `status1` 0x4C, flag bits (multi 6, inGamePartner 22), `inBattle` 0x439 bit 1, status and side bits. Open doubt: pret master's `SideTimer` lists 11 bytes while the 0x18 symbol size means 12 each; code uses 12 (opponent spikes only). Note in report, ask for a ROM fixture check.

**Left, in order.**
1. Fix the 5 expected test failures: `server/test/loop/read-loop.test.ts` (flag is now read every tick, so the "no read without demand" and `partyReads` helper need updating: party reads are ranges at ewram 0x244ec), `server/src/profile/registry.test.ts` (main batch parts are now `party` and `battle`; the tiny-caps test names the largest region, check it).
2. Tests: new `server/test/gen3/battle.test.ts` (outcome mapping every §7.8 value plus unknown, battler fields, stat stages, weather, sides, wild vs trainer, double, validation fails), loop tests (inactive shape with `lastBattle: null`, synthetic single wild and double trainer via `GET battle`, no subscriber `lastBattle` complete, game change resets), app route test for `/api/v2/battle`. Update `server/test/support/emerald-memory.ts` for battle memory.
3. Generator stable second run still holds; run `bun run lint`, `bun run typecheck`.
4. Council (Claude seat only), decision report `assets/068-gen3-battle-decoders-report.md` with unslop, `wf-time.py close`, record, push, open PR vs `wayfinder/v2-build-master` if the repo uses PRs.

Known failing and ignored: `core.test.ts` Lua check (host Lua 5.5).

Read first: `server/src/format/gen3/battle.ts`, `server/src/loop/read-loop.ts` (`cycle`), `server/test/loop/read-loop.test.ts`.
