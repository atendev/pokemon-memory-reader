# Decision report: Which bytes form the Ruby/Sapphire signature?

Grilling ticket, decided in auto mode on 2026-11-16. The main thread asked the questions and gave a recommendation for each. A sonnet grilling subagent answered, and a haiku auditor checked the result. Amendment: [036 amendment](./036-ruby-sapphire-signature-bytes.md). Facts: [036 facts](./036-ruby-sapphire-signature-bytes-facts.md).

## Research

Two sonnet research subagents looked into pret/pokeruby at `master` 5784633c and `symbols` 78b19905. The main thread checked their key claims against the source and the `.sym` files.

- The GF ROM header in `src/crt0.s` is entirely `.ifdef GERMAN`. English Ruby and Sapphire have no header at `0x08000100`. This changed the ticket's premise, which was that the header has no table pointers.
- `atk93_tryKO` is a naked asm function with `.4byte gBattleMoves` at +0x16C in all 11 builds. `sPokemonMenuActions` + 0x50 holds `gMoveNames` + 13*15. Nothing at a position fixed by source holds `gBaseStats` or `gItems`.

## Decisions

| # | Question | Options | Choice | Made by | Audit |
|---|---|---|---|---|---|
| 1 | What basis does the signature use, given English builds have no header? | (a) one symbol-derived signature for all builds; (b) German header words plus other English words; (c) no English signature; (d) words from the owner's ROM by dev script | (a), with these additions: a spec amendment, `pokeruby_de_debug` excluded, exact-name local lookups with size checks | Main thread recommended, grilling subagent accepted | Approved in round 3 |
| 2 | Which words? | (a) `gBattleMoves` word only; (b) plus the `gMoveNames` word; (c) plus an inferred `gItems` literal-pool word | (b), and the missing species and item guard is recorded as a known gap | Main thread recommended, grilling subagent accepted | Approved in round 3 |
| 3 | What does the profile record? | (a) the same `[{ address, bytes }]` shape; (b) an added anchor field | (a). The auditor asked for the expected values to be written out, and they now are. | Main thread recommended, grilling subagent accepted, auditor fix | Fixed in round 1, approved in round 3 |
| 4 | What shape does the generator definition take? | (a) `{ at: number or { symbol, offset, size }, value: { symbol, offset } }`; (b) a code path only for Ruby | (a). Values use the global lookup, and only anchors use the local one. The auditor asked for the parser-rule change to be recorded for the spec. | Main thread recommended, grilling subagent accepted, auditor fix | Fixed in round 1, approved in round 3 |
| 5 | Does an owned English ROM confirm the German builds? | (a) yes, one mapping; (b) German needs its own ROM | (a). This confirms the mapping only, and each revision still needs its hash chain. The auditor asked for proof of the German offset, and all 11 `.sym` labels supply it. | Main thread recommended, grilling subagent accepted, auditor fix | Fixed in round 1, approved in round 3 |
| 6 | Where does the build work go? | (a) the future Ruby/Sapphire profile ticket; (b) a generator-only task now | (a), with a fog line on the map that points to the amendment | Main thread recommended, grilling subagent accepted | Approved in round 3 |
| 7 | Should CONTEXT.md define the term? | (a) add a **Signature** entry; (b) leave it out | (a), reworded by the subagent: the words are pointers to tables, and a failed signature rejects only a header match. The existing uses of "signature bytes" were aligned with it. | Main thread recommended, grilling subagent amended | Approved in round 3 |

## Audit

Round 1 raised five problems: the expected bytes were missing, the claim about cartridge reads had no source, the German offset was unproven, the parser-rule change was unrecorded, and the text said the owner had a ROM. The main thread fixed all five. Round 2 raised two more: the cartridge-range cite named §5.5 instead of §5.6, and one line in the facts file still said the German offset was unproven. Both were fixed, and round 3 approved.

## For the master

- Add a line to the "rest of Gen 3" fog on the map. It says the Ruby/Sapphire profile work cites the 036 amendment and builds the generator change, which adds local anchor lookups, anchored words and `.sym` excerpt fixtures.
- No new tickets.
