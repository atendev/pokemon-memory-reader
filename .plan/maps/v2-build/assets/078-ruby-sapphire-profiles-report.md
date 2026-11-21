# Decision report: Ruby and Sapphire profiles

Ticket 078. Branch `t3/ruby-sapphire-profiles-078`, built over two threads. Auto mode was on. The council ran with the Claude seat only. Gemini and GPT: not run (out of quota).

## Decisions

**1. Put the per-game battle layout in a profile `constants` block.**
- Options: branch in the decoders on the profile's game, add four separate profile fields, or add one strict optional `constants` object with Emerald defaults.
- Choice: the `constants` object (`inBattleOffset`, `sideTimerSpikesOffset`, `moneyMultiplierOffset`, `trainerMoneyEntrySize`). Made by the implementer.
- Reason: spec §5 already calls these per-game constants. Emerald and FireRed JSON stays unchanged because the defaults are their values. Unknown keys are rejected, and a test covers that.

**2. Make `gBattleResources` optional.**
- Options: invent a symbol, or make the address optional.
- Choice: optional. Made by the implementer.
- Reason: pokeruby has no such symbol and nothing reads it. This matches how 077 handled `gTrainerBattleOpponent_B`.

**3. Anchor signature words with a size check.**
- Choice: `SignatureWord { at, value }`, where `at` is a symbol, a size and an offset. `requireAnchor` fails when the symbol is missing, appears more than once, or has the wrong size. Made by the implementer, from the 036 amendment.
- Reason: the two anchors are local symbols (`atk93_tryKO + 0x16C`, size 0x2E0, and `sPokemonMenuActions + 0x50`, size 0xC0). A moved function changes the size, so the word may have moved. The sym parser keeps local symbols by exact name for anchors only, so a global with the same name cannot hide a duplicate.

**4. Table count override.**
- Choice: a `count` on a table definition, used for `gTrainerMoney` (symbol size 0, 55 entries of 4 bytes from `data/trainer_money.inc`). Made by the implementer.

**5. The opposing trainer and the species table.**
- pokeruby has `gTrainerBattleOpponent` (singular) and no `_B`, so Ruby has no two-opponent battle and `twoOpponents` is false. The species table is `gBaseStats`, mapped to the `gSpeciesInfo` key.
- `gBattleStruct` is `gSharedMem + 0`, taken from `include/ewram.h`.

**6. Hold nothing back.**
- All six English revisions have a pret SHA-1 with a No-Intro entry, so none is held back. All six are rated `unconfirmed`, because no one has checked a retail ROM. `sapphire-de-1.0` stays held back as before. English only here.
- `SIGNATURE-EVIDENCE.md` is generated, so it lists the six new profiles as `unconfirmed` and carries no hand-written reasoning. The reasoning is here and in the ticket resolution. `CONTEXT.md`'s Signature entry needs no change, because it does not name a header.

**7. Test strategy.**
- Generator tests on pokeruby `.sym` excerpts, `.sha1` files and a No-Intro DAT excerpt, comparing each generated profile byte for byte with the committed file. A failing synthetic test for a wrong-size anchor, a missing or repeated anchor, and a table `count` override.
- `loop/ruby.test.ts` runs the read loop on synthetic Ruby memory for all six builds, including the static `gPokemonStorage` address.
- `gen3/battle-ruby.test.ts` checks the four layout constants. The constants schema rejects unknown keys.
- No ROM bytes are committed.

## Mutation check

Each change below made at least one test fail, then was reverted:
- one signature byte in `ruby-us-1.0.json`
- the anchor size check and the once-only check in `sym.ts`
- each of the four constants in `ruby-us-1.0.json` (decoder tests)
- `inBattleOffset` and `trainerMoneyEntrySize` in the definitions (generator tests)

## Verification

`bun test` gives 1427 pass and 1 fail. The failure is "Lua core runs under Lua 5.3 or 5.4", caused by this machine's Lua 5.5.1, not by the change. Typecheck and `biome ci` are clean. CI was not run, by instruction. The master runs it on the merged batch.

## Audit

Round 1, Claude seat only: APPROVE, score 8. Gemini and GPT: not run. No blocking problem. Three minor problems, one seat, all declined:

- The layout numbers (`0x43D`, spikes at +6, `0x16056`, 4-byte money entry) rest on grep of pinned pret source, and the synthetic tests reuse them. Declined: the facts file (`078-ruby-sapphire-profiles-facts.md`) cites the pinned commits and files. A real-game check needs a Ruby or Sapphire ROM, which the owner does not have here. Surfaced as a follow-up.
- The No-Intro DAT excerpt does not state where its rows came from. Declined: the excerpt is the same shape as the existing FireRed one, and the seat itself checked that the Ruby 1.0 SHA-1 matches its row.
- The money count 55 is hand-written. Declined: it comes from `data/trainer_money.inc` and the seat checked the other table counts against symbol sizes. A test fixes the region to the 55 entries.

## Skipped gates

Jev audit (parent ran it), the commit question (the master merges), CI (the master runs it), and the Gemini and GPT seats.
