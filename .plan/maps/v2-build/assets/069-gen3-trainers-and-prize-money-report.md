# Gen 3 trainers and prize money: decision report

Branch `t3/gen3-trainers-prize-money-r3`. Audit: Claude seat APPROVE 8/10 in round 1. The Gemini and GPT seats were out of quota and are `n/a`. One Claude APPROVE passes the gate, as the brief set.

## Decisions

### 1. Two-opponent battles are not doubled

- **Question.** The ticket says prize money is doubled when `BATTLE_TYPE_DOUBLE` is set. A two-opponent battle sets `DOUBLE`, `TWO_OPPONENTS` and `TRAINER` together. Is each trainer's amount doubled there?
- **Options.** Follow the ticket text and double. Follow the game source and pay each trainer its own undoubled amount.
- **Choice.** Undoubled. Made by the implementer in an earlier thread and re-checked in this one against pokeemerald `GetTrainerMoneyToGive` (`src/battle_script_commands.c`). The function reads `if TWO_OPPONENTS: no multiplier, else if DOUBLE: x2`. A double battle against one trainer is doubled.
- **Status.** The ticket text and spec §7.8 differ from the game here. The code follows the game. `Trainer.prizeMoney` has a `.describe()` and the `Trainer` TSDoc says so. The spec text should be fixed by the master.
- **Audit.** The Claude seat flagged that the diff does not quote the source. This report and the source lines above answer it.

### 2. Table-derived fields come in a second step, after a cached ROM read

- **Question.** The frame decoder only reads RAM. The trainer tables live in ROM.
- **Choice.** The frame decoder lists each trainer with null table fields. A new `TrainerFill` part on `BattleDecoder` names the ROM regions a frame needs. The read loop reads each region once per session and caches it. A failed read is retried after 5 seconds. `fill` is pure and nulls only the fields whose region is missing. Made by the implementer.
- **Why.** A missing table or a failed ROM read never drops the frame, and a ROM region is never re-read each tick.

### 3. `gBattleStruct` is its own read part

- **Choice.** `moneyMultiplier` (u8 at offset 0x4a of `struct BattleStruct`) is read as a separate part, `extras`. An unreadable `gBattleStruct` nulls the money only. The offset was checked in this thread against the pokeemerald struct: 72 bytes up to `focusPunchBattlerId`, then `battlerPreventingSwitchout`, then `moneyMultiplier` at 74 (0x4a).

### 4. Two-opponent party split

- **Choice.** `gEnemyPartyCount` counts both opponents' mons, but trainer A's mons fill only slots 0 to 2 and trainer B's fill slots 3 to 5. A two-opponent battle reads all six slots, skips all-zero slots, and gives slots 3 to 5 `trainer: 1`. "Last mon" per trainer is the highest occupied party slot of that trainer.

### 5. Battles with no trainer table

- **Choice.** Battle type bits for link (1), Battle Tower (8), e-Reader (11), Dome (16), Palace (17), Arena (18), Factory (19), Pike (20), Pyramid (21), Tower link multi (23), recorded link (25), Trainer Hill (26) and secret base (27) set `tableDerived: false`. Those frames read no ROM and keep every table field null.

### 6. Money lookup

- **Choice.** The lookup falls back to the `0xFF` terminator's value when no class matches, which is what the game's loop does.

### 7. Test ROM

- **Choice.** Tests place small synthetic tables in a ROM buffer built in the test. No ROM bytes are committed. The stock profile's tables sit past the 0x400-byte fixture ROM, so fixtures read them as missing (§12.2).

## Audit rounds

| Round | Seat | Verdict | Score |
| --- | --- | --- | --- |
| 1 | Claude | APPROVE | 8 |
| 1 | Gemini | n/a | n/a |
| 1 | GPT | n/a | n/a |

Problems raised (all minor, one seat):

1. Doubling rule rests on an unquoted source. Rebutted above (decision 1).
2. `maxRom` with a trainers table count of 0 built a region at base minus 40. **Fixed**, with a test.
3. `MONEY_MULTIPLIER_OFFSET` and the opponent addresses have no source in the diff. The offset was verified against the struct (decision 3). **Declined for the addresses**: they come from the generated profile and the tests reuse them, so a wrong address would need a real-game fixture to catch.
4. The 5-second ROM retry path has no test. **Declined**, minor from one seat. The retry only decides when a failed read runs again, and `fill` already nulls the fields while the region is missing.

## Skipped gates

- Jev audit, per the parent session.
- Commit-gate question, per the brief. The master merges.
- CI, per the brief.

## Checks

- `bun run typecheck` and `biome ci .` are clean.
- `bun test server`: 582 pass, 1 fail. The failure is `server/test/bridge/core.test.ts` ("the Lua core runs under Lua 5.3 or 5.4"). It fails the same way on `wayfinder/v2-build-master` (this machine has Lua 5.5), so it is unrelated to this work.
