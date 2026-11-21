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

Branch `t3/gen3-battle-decoders`, SHA is the commit after `ae4d348` (wip: handoff). Audit round 0, no council yet.

**Done.** Slice 1 at `ae4d348`: the generator emits `gMain`, `gBattlerPartyIndexes`, `gBattleOutcome`, `gBattleWeather`, `gSideStatuses`, `gSideTimers` into Emerald `addresses` (the "battle block" is these keys, not a new top-level profile key; record that decision in the report). `gen3Addresses` accepts them, the sym excerpt fixture has them, and a second `generate:profiles` run is stable. Typecheck and 94 profile and generator tests pass. Run `bun install` in the worktree first.

**Facts (pret master headers, checked).**
- `gMain.inBattle` is byte `+0x439`, mask `0x02`. `gMain` is 0x43c bytes.
- `BattlePokemon` is 0x58 bytes: species 0, atk 2, def 4, spe 6, spa 8, spd 0xA, moves[4] 0xC, statStages[8] 0x18 (HP, ATK, DEF, SPE, SPA, SPD, ACC, EVA, neutral 6), ability 0x20, types[2] 0x21, pp[4] 0x24, hp 0x28, level 0x2A, maxHP 0x2C, item 0x2E. `gBattleMons` is 4 entries.
- `gBattlerPartyIndexes` is u16[4]. `gBattleOutcome` is u8 (mask 0x7F). `gBattleWeather` is u16: rain 0x7, sandstorm 0x18, sun 0x60, hail 0x80. `gSideStatuses` is u16[2]: reflect 1, lightscreen 2, spikes 0x10, safeguard 0x20, mist 0x100. `gSideTimers` is 2 x 12 bytes, spikesAmount at +10.
- Type flags: double bit 0, trainer bit 3, two-opponents bit 15. Battler order: 0 player, 1 opponent, 2 partner, 3 opponent 2.

**Left, in order.**
1. `server/src/format/gen3/battle.ts` decoder returning `BattleTick`, plus `Decoder.battle` and `BoundGame.battle`.
2. Read loop: read the `inBattle` flag every tick, read the full battle regions while the flag was last set or `battle` is demanded, keep tracker state in the session, call `initial()` on a game change.
3. Add `battle` to `TOPIC_NAMES`, `ResourceMap`, `resourceSchemas`, `SNAPSHOT_TOPICS` and `DECODED`.
4. Tests: inactive shape, synthetic single wild and double trainer battles, every §7.8 outcome plus unknown, no-subscriber `lastBattle`.
5. Council (Claude seat only), decision report with unslop, `wf-time.py close`, record, push.

Read first: `server/src/resource/battle-tracker.ts`, `server/src/loop/read-loop.ts`, `server/src/format/registry.ts`, `server/test/support/battle-frames.ts`.
