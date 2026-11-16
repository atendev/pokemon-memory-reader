# Ruby/Sapphire signature words: amendment for spec §5.3 and §5.4

Resolves [Which bytes form the Ruby/Sapphire signature?](../tickets/036-ruby-sapphire-signature-bytes.md) and replaces item 9 of the [022 amendment](./022-unowned-revision-signatures.md). Facts behind it: [036 facts](./036-ruby-sapphire-signature-bytes-facts.md).

These were decided in auto mode on 2026-11-16 (UTC). The main thread asked each question with a recommendation, and a grilling subagent answered. Sources are pinned to pret/pokeruby `master` 5784633ce4ef7ade1a7f2d2d0c288e3d5e6cdd7f and `symbols` 78b19905a760095bc45eab2e36906c6e8c208dce.

## Why the header can't be used

pokeruby's GF ROM header (`src/crt0.s` lines 74-151) sits entirely inside `.ifdef GERMAN`. English Ruby and Sapphire, including Ruby US 1.0 (a primary revision the owner doesn't own yet), have ARM code at `0x08000100` and no header. German builds have one, but it points at picture tables, `gSpeciesNames`, `gMoveNames` and `gDecorations`, and has no slot for `gBaseStats`, `gItems` or `gBattleMoves`. No naked-asm word or static data initializer anywhere in pokeruby holds `gBaseStats` or `gItems`.

## Decisions

1. **One signature for every pokeruby retail build.** English and German Ruby and Sapphire all use the same two words, found the same way. German builds don't use their header words. pokeruby keeps one mapping, so 022 items 2 to 8 apply unchanged.
   - **Excluded:** header words for German and other words for English (two mappings, and German could only be confirmed by a German ROM), no signature for English (022 item 3 excluded shipping without one), and literal-pool words picked from the owner's ROM by a dev script (unowned revisions would get none).

2. **The two words.** Each is a 4-byte little-endian word whose position and value both follow from pret source and the `.sym` file, with no ROM.
   - **`gBattleMoves` word**: at `atk93_tryKO + 0x16C`. `atk93_tryKO` in `src/battle_script_commands.c` is a naked asm function, and `_08026CE4: .4byte gBattleMoves` sits `0x16C` bytes after its start. The asm label `_08026CE4` is itself in every `.sym` file and sits at `atk93_tryKO + 0x16C` in all 11 builds, English and German (Ruby US 1.0: `0x08026CE4 - 0x08026B78`; German: `0x08026EB8 - 0x08026D4C`). The value is the address of `gBattleMoves`.
   - **`gMoveNames` word**: at `sPokemonMenuActions + 0x50`. `sPokemonMenuActions` in `src/pokemon_menu.c` is a static table of 8-byte `{ text, func }` entries, and entry 10 is `{ gMoveNames[MOVE_CUT], ... }`. The value is the address of `gMoveNames` plus `13 * 15` (`0xC3`), because a move name is 13 bytes and `MOVE_CUT` is 15.
   - Both guard the move tables, from code and from data. A hack that repoints either table changes its word.
   - **Excluded:** a literal-pool word for `gItems` taken from the end of a compiled function such as `ItemId_GetName`. Its position is compiler output that can't be proved without a ROM. If the guess were wrong, every hashless retail match of an unowned revision would fall to `unidentified`.
   - **Known gap.** No Ruby/Sapphire word guards the species or item tables. A hack that moves only those tables and keeps the retail header still header-matches on an emulator that gives no hash. This joins the known gap §5.4 already records.

3. **Profile shape unchanged.** `identify.signature` stays `[{ address, bytes }]` with concrete addresses (§5.1). Ruby US 1.0 (`pokeruby.sym`) records `{ address: 0x08026CE4, bytes: "2cb11f08" }` (`gBattleMoves` at `0x081FB12C`) and `{ address: 0x0839F4E4, bytes: "e3831f08" }` (`gMoveNames` `0x081F8320` + `0xC3`), in the same `bytes` notation as `emerald-us-1.0.json`. The runtime compares bytes as it does for Emerald. The anchor symbols and offsets live only in the generator definition, with a comment citing the source lines. Reading these addresses needs no new adapter capability, because the program already reads cartridge space outside the header: official profiles read trainer tables from ROM ([025 amendment](./025-spec-text-mismatches.md)), and spec §5.6 accepts any hack table in `0x08000000`-`0x09FFFFFF`. An adapter without ROM reads gives `unchecked`, as today.

4. **Generator definition.** A signature word becomes `{ at, value }`. `at` is either a number (Emerald's header words keep this) or `{ symbol, offset, size }`. `value` is `{ symbol, offset }`. The generator reads `at.symbol` as a local or global symbol by exact name. It fails if the name is missing, appears more than once in the `.sym`, or has a size other than `at.size` (`0x2E0` for `atk93_tryKO`, `0xC0` for `sPokemonMenuActions`). `value.symbol` is a global symbol and uses the existing global lookup. The parser keeps ignoring other local symbols. There is no Ruby-only code path. This changes the Emerald generator's rule that only global symbols count, for named anchors only. The size check catches a pret change that moves the word inside the anchor.

5. **Mapping confirmation.** The mapping is "this source position holds this table address", and it doesn't depend on language or revision. Both anchors have the same size in all 11 pokeruby `.sym` files. Once the owner has a Ruby ROM, its `test:local` run confirms it for every pokeruby revision, English and German, so the others reach `chain`. This confirms the field mapping only: each revision still reaches `chain` only when its own pret SHA-1 equals a No-Intro SHA-1. Sapphire German 1.0 stays held back (022 item 4). `pokeruby_de_debug` has no retail ROM and gets no profile.

6. **Build work.** No ticket now. The Ruby/Sapphire profile build, still fog under "the rest of Gen 3", cites this amendment and builds items 2 to 5 with `.sym` excerpt fixtures. The map's fog line for that work names this amendment and the facts file so it isn't lost.

7. **Glossary.** CONTEXT.md gains a **Signature** entry. It says the words point to the game's data tables, not that they are the tables' addresses, since the `gMoveNames` word points into its table. It doesn't say "header". It says a mismatch rejects only a header match, since a hash match is trusted and a mismatch there is only logged.

## Spec text to change

When the spec is next updated:

- §5.3 "Vanilla signatures" and §5.4 "Vanilla signature" say the words are GF ROM header words that point to the species, item and move tables. They become: Emerald and FireRed use those header words. Ruby and Sapphire use the two words of item 2.
- §5.4's sentence "A game with no GF ROM header gets other retail bytes picked with the Gen 1-2 dev script" no longer covers Ruby and Sapphire.
- §5.4's known gap gains item 2's species and item gap.
- §5.3 gains item 4: the generator reads named local symbols as signature anchors, with the size check.
