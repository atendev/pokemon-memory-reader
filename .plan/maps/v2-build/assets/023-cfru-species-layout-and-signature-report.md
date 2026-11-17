# Decision report: How is the species-info layout confirmed, and does the signature still catch CFRU builds without DPE?

Grilling ticket, run in auto mode on 2026-11-17 (UTC) as a wayfinder-master child. The main thread wrote the questions and recommendations, and a Sonnet grilling subagent answered them. Facts came from one Sonnet research subagent (CFRU header repoints) and the repo's committed `pokeemerald.excerpt.sym`. Amendment: [023-cfru-species-layout-and-signature.md](./023-cfru-species-layout-and-signature.md). Facts: [023 facts](./023-cfru-species-layout-and-signature-facts.md).

## Decisions

| # | Question | Options | Choice | Made by |
| --- | --- | --- | --- | --- |
| 1 | How is the vanilla 0x1C stride confirmed? | generator check on pret sym sizes; `test:local` on retail ROM; both | Generator check: symbol size equals species count × 0x1C, run fails otherwise, CI test on the excerpt | main thread recommended, grilling subagent accepted |
| 2 | How is the CFRU stride confirmed? | owner-ROM `test:local`; ABI reasoning alone; `find-rom-tables` stride measure; owner ROM plus script | Owner-ROM `test:local` (valid at 0x1C, invalid at 0x1A and 0x1E) plus the `find-rom-tables` measure | main thread recommended, grilling subagent accepted |
| 3 | What does the confirmation gate? | Gen 3 `supported`; hack species-table reading only; CFRU `supported` | Hack species-table reading only | main thread recommended, grilling subagent accepted |
| 4 | Runtime guard for unchecked user profiles | keep §5.6 validation plus a wrong-stride synthetic test; `stride` field; entry 0 all zero | Keep validation and add the test, which must fail at a wrong stride before the decoder ships | main thread recommended, grilling subagent accepted; council made it an expectation to prove |
| 5 | Does the vanilla signature still catch CFRU without DPE? | yes through 0x1CC, signature unchanged; add 0x1C0 to FR/LG; add 0x1C0 everywhere | Yes through 0x1CC at the pinned commit, signature unchanged | main thread recommended, grilling subagent accepted; council narrowed the scope |
| 6 | How is the CFRU gate enforced? | ledger row and release gate; `RELEASING.md` line; provenance field | Ledger row per built-in hack profile and ROM SHA-1, with failure rows that block | main thread recommended, grilling subagent accepted |
| 7 | Is the 0x1CC caveat checked? | in the same row; unrecorded report line; no check | Same row also asserts the base profile's signature fails, and records the base profile ID | main thread recommended, grilling subagent accepted and added the profile ID |
| 8 | Where does it live and what gets built now? | one amendment plus ticket 059 with the rest in the fog; three tickets now; nothing now | One amendment, ticket 059 now, the hack checks stay in the CFRU fog | main thread recommended, grilling subagent accepted |

## Audit

Council round 1: Gemini APPROVE 10, GPT APPROVE 8, Claude (Haiku) DISAPPROVE 7. The Claude seat raised two blocking problems: the DPE `0x1BC` claim lacked a citation, and "every CFRU build" generalized one pinned commit. It also raised two minor ones: the species count's source was unnamed, and the wrong-stride rejection was asserted without evidence. GPT raised one minor problem: the claim that a pret build is byte-identical to retail had no evidence. All five were fixed: the DPE claim cites the v2-rebuild research, the CFRU facts are scoped to the pinned commit, the species count comes from the reference generator, decision 4 is an expectation the synthetic test must prove, and the pret claim cites `make compare` against `rom.sha1`.

Round 2 (Claude seat only): APPROVE 8. Both blocking problems were confirmed fixed. Three minor problems from that seat alone were declined:
- The fallback "stricter check" if the wrong-stride test passes isn't named. Declined: that check belongs to the build ticket under the CFRU fog, which can name it once the decoder exists.
- The `rom.sha1` and ticket 005 claims weren't checked in that round. Declined: the map's Decisions entry for ticket 005 records the generator's check against pret `rom.sha1`, and the committed copy is `scripts/generate-profiles/fixtures/pokeemerald.rom.sha1`.
- The `gen3-en.json` count of 412 wasn't read. Declined: the map's Decisions entry for ticket 008 records 412 species in `gen3-en.json`.

Round 3 (confirming, Gemini and GPT): Gemini APPROVE 10, GPT APPROVE 9, no problems. Final: COUNCIL APPROVE, round 3, claude 8, gemini 10, gpt 9.

## Gates skipped

The grilling ran in auto mode, so the user wasn't interviewed. The step 5 commit question was skipped on the master's standing instruction to commit every time. Unslop was applied inline while writing this report, not as a separate pass, to stay under the context limit.
