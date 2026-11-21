# Decision report: FireRed and LeafGreen profiles

Ticket 077. Branch `t3/firered-leafgreen-profiles-2`, built over two threads.

## Decisions

**1. Share one repo pin across the four builds.**
- Options: pin each build separately, or pin symbols to one `symbols` commit and SHA-1 files to one `master` commit.
- Choice: one pin each (symbols 3b401eaf, SHA-1 files ce6406d8). Made by the implementer.
- Reason: the builds differ only in ROM addresses. The table sizes and save layouts match.

**2. Share the Game Freak signature and the No-Intro source.**
- Options: copy the Emerald signature per game, or rename `EMERALD_SIGNATURE` to `GF_SIGNATURE` and share it.
- Choice: share. Made by the implementer.
- Reason: `sGFRomHeader` sits at 0x08000100 with the same field order in pokefirered.

**3. Make `gTrainerBattleOpponent_B` optional.**
- Options: invent a placeholder symbol, add a per-game profile flag, or make the address optional.
- Choice: optional. When it is missing, `twoOpponents` is false and region B reads A. Made by the implementer.
- Reason: pokefirered has no such symbol. Bit 15 there is `BATTLE_TYPE_GHOST`, not two opponents. Checked against `include/constants/battle.h`: bits 0, 3, 6 and 15 match the decoder's use.

**4. Hold nothing back.**
- Options: hold back any build, or ship all four.
- Choice: ship all four. All four pret SHA-1s have No-Intro entries, so no chain is broken. All four are rated `unconfirmed` by the evidence ledger, because no one has checked a retail ROM.
- The existing hold-back mechanism is unchanged. A test now runs a FireRed definition with a bogus SHA-1 through `planGeneration`. It gives a message, no file, no index entry and no failure.

**5. Test strategy.**
- Loop test on synthetic FireRed memory for all four builds (profiles load, status, party, player, bag, boxes).
- Generator tests on real pokefirered `.sym` excerpts, `.sha1` files and No-Intro DAT entries, taken from the pinned commits. Each generated profile is compared byte for byte.
- Battle tests for the optional B address.
- No ROM bytes are committed.

**6. Loop test fixes (thread two).** The 13 failures were wrong test expectations, not wrong shapes:
- `registry.keys()` became `registry.all()`.
- `Status` is the condition enum, so the test now uses `StatusResource`.
- `Party.pokemon`, not `mons`.
- `status.game.profileId` and `match: "exact"`.
- `player.location.section` is `{ id, name }` and `playTime.frames` exists.
- One was a real test bug: the synthetic PC storage block at 0x30000 overwrote `gMapHeader` at 0x36dfc, so the section read 0. The storage moved to 0x10000.

**7. Fixture and counting tests.** The committed notes test and the No-Intro entry count (3 to 7) now include the FireRed builds.

## Audit

- Round 1: Claude seat DISAPPROVE, 7. One blocking problem: no test ran a broken-chain FireRed revision. Fixed with decision 4's tests. Three minor problems were rebutted with evidence (bit constants checked against pokefirered, a grep showing B is read only in `battle.ts`, and the species-stride check).
- Round 2: Claude seat APPROVE, 8. One minor problem (typecheck unconfirmed after the fix), declined as resolved: typecheck reports 0 errors and lint is clean.
- Gemini and GPT seats: `n/a`, out of quota. One Claude APPROVE passes the gate.
- Minor problems declined: 1.

## Not verified

- Signatures and addresses are unchecked against a retail ROM, because no ROM or emulator is available.
- Battle type bits 16 to 19 mean different things in FireRed (Pokédude, scripted wild, legendary, Trainer Tower). They fail safe by nulling table-derived fields.
- The money formula in a real battle.
- Item names. `gen3-en.json` comes from pokeemerald, so FireRed and LeafGreen key items and TMs get wrong or null names.

## Surfaced tickets

- Gen 3 item names per profile (blocked by this ticket).
- FireRed battle verification on a real game (blocked by this ticket).

## Test run

Full `bun test`: 1097 pass, 1 fail. The failure is the Lua 5.5 version check in `server/test/bridge/core.test.ts`, which is unrelated. Typecheck and lint are clean.
