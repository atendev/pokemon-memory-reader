# 036 Ruby/Sapphire GF ROM header facts (pret/pokeruby)

Pinned commits (queried 2026-11-16 via `gh api`):
- pret/pokeruby `master` = 5784633ce4ef7ade1a7f2d2d0c288e3d5e6cdd7f
- pret/pokeruby `symbols` = 78b19905a760095bc45eab2e36906c6e8c208dce
- pret/pokeemerald `master` = 9103e529c2fbdd7add4a1ff3350c6c1f92112c42

Sources: CRT0 = https://raw.githubusercontent.com/pret/pokeruby/5784633ce4ef7ade1a7f2d2d0c288e3d5e6cdd7f/src/crt0.s
SYM  = https://raw.githubusercontent.com/pret/pokeruby/78b19905a760095bc45eab2e36906c6e8c208dce/<name>.sym

## 1. Headline finding: the GF header exists only in German builds
- In `src/crt0.s` the whole block from `.ifdef GERMAN` (line 74) to its `.endif` (line 151) holds the 0xD0-0xFF filler AND the GF header. There is no `.else` for the GERMAN conditional. Source: CRT0.
- English Ruby/Sapphire (all revs) therefore have NO GF header at 0x08000100. Evidence: `Init` is at 0x080000D0 in pokeruby.sym, pokesapphire.sym and pokesapphire_rev2.sym (and sp_sys at 0x08000104, sp_irq 0x08000108, i.e. ARM code and literals occupy 0x100). German builds have `Init` at 0x08000204 in pokeruby_de, pokeruby_de_rev1, pokeruby_de_debug, pokesapphire_de, pokesapphire_de_rev1. Source: SYM pokeruby.sym / pokesapphire_de.sym / the others.
- Language constants: `GAME_LANGUAGE` = 2 for ENGLISH, 5 for GERMAN; `GAME_VERSION` = 1 for SAPPHIRE, 2 for RUBY (constants/version.inc, constants/misc_constants.inc at the CRT0 commit).
- Only `.ifdef` conditionals in the header are GERMAN (whole block) and SAPPHIRE (game-name string). No REVISION conditional in crt0.s (REVISION is only passed via ASFLAGS in Makefile:94). Rev0/rev1/debug German share the same layout; only pointer targets move.

## 2. Header layout (German builds), ROM address = 0x08000000 + offset
Directives: 12 x `.4byte 0xFFFFFFFF` at 0xD0..0xFF; then:
- 0x100 GAME_VERSION (u32; Sapphire 1, Ruby 2)
- 0x104 GAME_LANGUAGE (u32; German 5)
- 0x108 game name, 32 bytes: `.ascii "pokemon sapphire version"` (24) + `.space 8`, or `.ascii "pokemon ruby version"` (20) + `.space 12`. Ends 0x127.
- 0x128 gMonFrontPicTable
- 0x12C gMonBackPicTable
- 0x130 gMonPaletteTable
- 0x134 gMonShinyPaletteTable
- 0x138 gMonIconTable
- 0x13C gMonIconPaletteIndices
- 0x140 gMonIconPaletteTable
- 0x144 gSpeciesNames
- 0x148 gMoveNames
- 0x14C gDecorations
- 0x150 0x1220, 0x154 0x1340, 0x158 0x18, 0x15C 0x938, 0x160 0x3A8C, 0x164 0x46, 0x168 0x836, 0x16C 0x84C, 0x170 0x182
- 0x174 0x0A0A0A07, 0x178 0x0C060C0C, 0x17C 0x0C121006, 0x180 0x08010B0F, 0x184 0x0C
- 0x188 0x890, 0x18C 0x3AC0, 0x190 0x234, 0x194 0x238, 0x198 9, 0x19C 0xA, 0x1A0 0, 0x1A4 8
- 0x1A8 0x556, 0x1AC 0x557, 0x1B0 0x312F, 0x1B4 0x311B
- 0x1B8..0x1FC: 0 (18 words)
- 0x200 0xFFFFFFFF; 0x204 = `Init` (matches sym files).
Total 55 words 0x128..0x200 (crt0.s lines 96-150). Addresses are computed by me from directives; `Init`=0x204 in the sym files confirms the arithmetic.
- Positionally the constants line up with Emerald's GFRomHeader fields (flagsOffset 0x1220, varsOffset 0x1340, pokedexOffset 0x18, seen1 0x938, seen2 0x3A8C, pokedexVar 0x46, pokedexFlag 0x836, mysteryEventFlag 0x84C, pokedexCount 0x182 = 386, name lengths 7/10/10/10, saveBlock2Size 0x890, saveBlock1Size 0x3AC0, party count/party offset 0x234/0x238 ...). Field names are my inference by position, not stated in pokeruby.

## 3. Pointer targets in the sym files (all present; sizes of the *Pic/Palette tables are 0 because they are labels)
pokeruby_de.sym: Init 08000204; gMonFrontPicTable 081f52d0; gSpeciesNames 082040e8 (0x11b4); gMoveNames 0820529c (0x1207); gBattleMoves 082080fc (0x10a4); gBaseStats 0820bbe8 (0x2d10); gMonIconTable 083c7c30 (0x6e0); gItems 083d13dc (0x3bfc); gDecorations 083f7bf0 (0xf20).
pokesapphire_de.sym: gMonFrontPicTable 081f5264; gSpeciesNames 0820407c (0x11b4); gMoveNames 08205230 (0x1207); gBattleMoves 08208090 (0x10a4); gBaseStats 0820bb7c (0x2d10); gMonIconTable 083c7b9c (0x6e0); gItems 083d1348 (0x3bfc); gDecorations 083f7b5c (0xf20).
pokeruby.sym (English rev0, for contrast; no header points at these): gMonFrontPicTable 081e8354; gSpeciesNames 081f716c; gMoveNames 081f8320; gBattleMoves 081fb12c; gBaseStats 081fec18; gMonIconTable 083bbd20; gItems 083c5564; gDecorations 083eb6c4.
Also present (pokeruby.sym / pokesapphire_de.sym): gMonBackPicTable (081e97f4 / 081f6704), gMonPaletteTable (081ea5b4 / 081f74c4), gMonShinyPaletteTable (081eb374 / 081f8284), gMonIconPaletteIndices (083bc400 / 083c827c, 0x1b8), gMonIconPaletteTable (083bc5b8 / 083c8434, 0x30).
- `symbols` branch files: .gitignore, pokeruby.sym, pokeruby_de.sym, pokeruby_de_debug.sym, pokeruby_de_rev1.sym, pokeruby_rev1.sym, pokeruby_rev2.sym, pokesapphire.sym, pokesapphire_de.sym, pokesapphire_de_rev1.sym, pokesapphire_rev1.sym, pokesapphire_rev2.sym. Line format: `<addr> <g|l> <size hex> <name>`. No German debug-free sapphire debug sym; no *_debug for English.
- Spot-checked German pointer targets differ per build (e.g. gDecorations pokeruby_de 083f7bf0, pokeruby_de_debug 084176ec, pokesapphire_de_rev1 083f7b5c; gSpeciesNames pokeruby_de_debug 0821ce3c): pointer values are build-specific, so only the layout is a stable signature.

## 4. gBaseStats / gItems / gBattleMoves
- Ruby's header words at the Emerald speciesInfo/items/moves positions (0x1BC onward) are all 0; there is no fixed header slot for gBaseStats, gItems or gBattleMoves in Ruby/Sapphire. Source: CRT0 lines 132-150.
- Code references them as plain externs (e.g. include/pokemon.h line 397 `extern const struct BaseStats gBaseStats[];`, used from src/pokemon_*.c, daycare.c, pokedex.c; gBattleMoves in include/data2.h, src/pokemon_1.c...; gItems in src/item.c). Compiled ARM/Thumb code reaches them via literal pools; I did not disassemble to confirm, so treat "literal pool only" as inferred from the absence of a header slot.

## 5. Emerald contrast
- pokeemerald `src/rom_header.s` is exactly 0x100 bytes (b Init, 156 + 12 + 4 + 2 ... GPIO halfwords at 0xC4-0xCA, `.space 0x34`; my arithmetic) and `src/rom_header_gf.c` `sGFRomHeader` follows (ld_script.ld lists rom_header.o then rom_header_gf.o first in .text). Source: https://raw.githubusercontent.com/pret/pokeemerald/9103e529c2fbdd7add4a1ff3350c6c1f92112c42/src/rom_header_gf.c , .../src/rom_header.s , .../ld_script.ld
- struct GFRomHeader offsets (relative to 0x08000100; counted by me): version 0x00, language 0x04, gameName[32] 0x08, monFrontPics 0x28, monBackPics 0x2C, monNormalPalettes 0x30, monShinyPalettes 0x34, monIcons 0x38, monIconPaletteIds 0x3C, monIconPalettes 0x40, monSpeciesNames 0x44, moveNames 0x48, decorations 0x4C, flagsOffset 0x50 ... unk18 0xB8, speciesInfo 0xBC, then abilityNames, abilityDescriptions, items, moves, ballGfx, ballPalettes...
- Result: Emerald and German Ruby/Sapphire share the same leading layout through unk18 (0xB8) at 0x08000100; absolute 0x128 = monFrontPics in both. Ruby leaves speciesInfo/items/moves null. Emerald's gameName is "pokemon emerald version".

## Open gaps
- English Ruby/Sapphire: no GF header at 0x100, so a 0x08000100-based signature cannot identify them; another discriminator is needed (cart header game code at 0xAC e.g. AXVE/AXPE, software version 0xBC). Not verified here.
- German Ruby/Sapphire real-ROM header bytes not checked against a dump (only pret's build source and sym files).
- Whether any other English ROM (e.g. pre-release/Japanese, not in pokeruby) carries the header: out of pokeruby's scope.
- Literal-pool use of gBaseStats/gItems/gBattleMoves not disassembled.

## Symbol-derivable table pointers (research 2)
Sources: pret/pokeruby commit 5784633ce4ef7ade1a7f2d2d0c288e3d5e6cdd7f (source), `symbols` branch 78b19905a760095bc45eab2e36906c6e8c208dce (.sym). Method: grep and .sym lookups only; no disassembly, no ROM bytes. Offsets below are my arithmetic.
- No hits in asm/*.s, data/*.s or .inc for `.4byte`/`.word` of gBaseStats, gItems, gBattleMoves, gSpeciesNames or gMoveNames (grep over the whole tree, 5784633). The asm/ and data/ trees have no such word; all literal pools for these are inside C `asm()` blocks.
- Only `.4byte gBattleMoves` literal pool: src/battle_script_commands.c:7151 (label `_08026CE4`, `ldr r1, _08026CE4 @ =gBattleMoves` at :7100), inside the NAKED function `atk93_tryKO` (def at :6980, matching branch of `#ifdef NOTMATCHING` at :6925/:6978). Pool sits mid-function (code resumes at `_08026CF4`), not at the end. Source: 5784633.
- `atk93_tryKO` is a local `l` symbol, size 0x2e0, at 08026b78 in pokeruby.sym, pokeruby_rev1.sym, pokeruby_rev2.sym, pokesapphire.sym, pokesapphire_rev1.sym, pokesapphire_rev2.sym; at 08026d4c in pokeruby_de, pokeruby_de_rev1, pokesapphire_de, pokesapphire_de_rev1; 0802a2f0 in pokeruby_de_debug (all size 0x2e0). Source: .sym files, 78b1990.
- Word address = atk93_tryKO + 0x16C (label `_08026CE4` minus 08026b78 = 0x16C; matches the original rev0 address, so the label name equals the real address in pokeruby.sym). Expected value: gBattleMoves (081fb12c pokeruby, 081fb144 rev1/rev2, 081fb0bc sapphire, 081fb0d4 sapphire rev1/rev2, 082080fc ruby DE). Example: pokeruby.sym word at 08026ce4 should be 081fb12c. Source: .sym + my arithmetic.
- No `#if GERMAN`/`ENGLISH` inside src/battle_script_commands.c lines 6900-7300 (only NOTMATCHING); function size is 0x2e0 in all 11 .sym files, and the `_08026CE4` label sits at +0x16C in every .sym, German included (see Gaps, research 2). No ROM bytes checked.
- Other literal-pool hits: src/de_rom_8040FE0.c:174 and :201 `.4byte gTrainers`, inside `#if GERMAN` (file starts `#if GERMAN` at :7, `#endif` at :223): German-only, mid-function pools, function label names `_080410C0`/`_080410F4`. Not usable for English. Source: 5784633.
- Static data initializers (C): `src/pokemon_menu.c` `static const struct MenuAction2 sPokemonMenuActions[]` (:126-152) holds `{gMoveNames[MOVE_X], PokemonMenu_FieldMove}` rows; struct MenuAction2 = `{const u8 *text; TaskFunc func;}` (include/menu.h:15), 8 bytes/entry. Table is symbol `sPokemonMenuActions` (`l`, size 0xC0 = 24 entries) in .sym. Entries 0-9 are other text; entry 10 is MOVE_CUT, 11 FLASH, 12 ROCK_SMASH, 13 STRENGTH, 14 SURF, 15 FLY, 16 DIVE, 17 WATERFALL, 18 TELEPORT, 19 DIG, 20 SECRET_POWER, 21 MILK_DRINK, 22 SOFT_BOILED, 23 SWEET_SCENT.
- So the word at sPokemonMenuActions + 8*i for i=10..23 equals gMoveNames + 13*MOVE_ID (gMoveNames is `const u8 [][13]`, include/data2.h:43). pokeruby.sym example: sPokemonMenuActions 0839f494; word at 0839f4e4 (+0x50) = 081f8320 + 15*13 = 081f83e3 (MOVE_CUT=15); word at 0839f4ec (+0x58) = 081f8320 + 148*13 = 081f8aa4 (MOVE_FLASH=148). Move IDs from include/constants/moves.h (15, 148, 249, 70, 57, 19, 291, 127, 100, 91, 290, 208, 135, 230); the pointer is gMoveNames + offset, not gMoveNames itself, so a generator subtracts 13*id to recover the table.
- sPokemonMenuActions per .sym (all size 0xC0): pokeruby 0839f494, rev1/rev2 0839f4ac, sapphire 0839f2dc, sapphire rev1/rev2 0839f2f4, DE ruby/rev1 083aac9c, DE sapphire/rev1 083aaae8, de_debug 083c9318. gMoveNames in same files: 081f8320 / 081f8338 / 081f82b0 / 081f82c8 / 0820529c / 08205230 / 0821dff0. Source: .sym files, 78b1990.
- Revision/language caveat for that table: no `#if` around the array; include/constants/moves.h has one preprocessor line (not inspected, presumably the include guard); src/pokemon_menu.c's only `#if DEBUG` blocks are at :919-931 and :943-945, after the table. Layout (index 10 = MOVE_CUT) is therefore the same across revisions and German; the table is also not in the .sym as a global (it is `l`), so the generator must rely on the local symbol being present in the .sym (it is, in all 11 files checked).
- Other static `gMoveNames[MOVE_X]` initializers: src/debug/start_menu_debug.c:1422-1430 `gUnknown_Debug_839BF94[]` (struct MenuAction, DEBUG build only; not in non-debug .sym).
- No other static initializers take gBaseStats, gItems, gBattleMoves, gSpeciesNames or gTrainers addresses (grep of src/data/include; other uses are indexed reads inside functions). Not found for gBaseStats/gItems at all outside functions.
- Fallback (single-table small functions, literal pool probably the last 4 bytes of the function, inferred from size not disassembled): src/item.c `ItemId_GetName` size 0x20 (pool likely at +0x1C), `ItemId_GetPrice` 0x24, `ItemId_GetHoldEffect` 0x24 (pool likely at +0x20); each calls static `SanitizeItemId` (size 0x18, uses ARRAY_COUNT(gItems), a constant) then indexes `gItems[...]`. Addresses in pokeruby.sym: ItemId_GetName 080a98d4, GetPrice 080a9918, GetHoldEffect 080a993c; sizes identical in all 11 .sym files. Source: src/item.c:422-447, .sym, 78b1990. item.c includes items_en.h/items_de.h under `#if ENGLISH`/`GERMAN` (:33-39) but the functions are outside it.
- Caveat on item.c fallback: GBA GCC pools can also hold other words; whether the pool word is gItems (vs gItems+offset, e.g. `.name` at +0) is unverified.

### Gaps (research 2)
- No ROM bytes checked: atk93_tryKO+0x16C and sPokemonMenuActions+0x50 values are derived from source and .sym only.
- ~~German atk93_tryKO pool offset assumed equal~~ Resolved by the main thread: the local label `_08026CE4` (the `.4byte gBattleMoves` line) is in every .sym, at atk93_tryKO + 0x16C in all 11 files (e.g. pokeruby_de.sym 08026eb8 - 08026d4c). The label name equals its address only in the rev0 English builds.
- Whether any real build moves the pool (e.g. rev1/rev2 compiler differences): sizes match but not disassembled.
- The pokemon_menu pointer is gMoveNames + 13*id (needs the move-ID constants), not a bare table address.
