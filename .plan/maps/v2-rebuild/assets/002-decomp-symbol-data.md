# Decomp symbol data for game profiles

Research for ticket 002. Checked 2026-11-10 against the live GitHub repos with the `gh` API and raw file reads. Items marked unverified were not confirmed from a primary source.

## Summary table

| Repo | Prebuilt symbols | Files on `symbols` branch | Revisions and regions buildable | License |
| --- | --- | --- | --- | --- |
| [pret/pokered](https://github.com/pret/pokered/tree/symbols) | Yes, `symbols` branch | `pokered`, `pokeblue`, `_debug` (blue), `_vc` variants, each as `.sym` and `.map` | English Red and Blue, plus Virtual Console builds. No Japanese or other regions found in the Makefile. | No LICENSE file in repo |
| [pret/pokeyellow](https://github.com/pret/pokeyellow/tree/symbols) | Yes | `pokeyellow`, `_debug`, `_vc`, `.sym` and `.map` | English Yellow plus VC and debug | No LICENSE file |
| [pret/pokegold](https://github.com/pret/pokegold/tree/symbols) (also covers Silver) | Yes | `pokegold`, `pokesilver`, each with `_debug` and `_vc`, `.sym` and `.map` | English Gold and Silver, plus VC and debug | No LICENSE file |
| [pret/pokecrystal](https://github.com/pret/pokecrystal/tree/symbols) | Yes | `pokecrystal`, `pokecrystal11`, `pokecrystal_au`, debug and 1.1 VC variants | Crystal 1.0, 1.1, and the Australian build (`_au`), selected by `make crystal`, `crystal11`, `crystal_au` targets | No LICENSE file |
| [pret/pokeruby](https://github.com/pret/pokeruby/tree/symbols) | Yes, `.sym` only (no `.map`) | `pokeruby`, `pokesapphire`, each with `_rev1`, `_rev2`, `_de`, `_de_rev1`; plus `pokeruby_de_debug` | Ruby and Sapphire, revisions 1.0 / 1.1 / 1.2, German. Selected by Makefile target names such as `ruby_rev1`, `sapphire_de`. | No LICENSE file |
| [pret/pokeemerald](https://github.com/pret/pokeemerald/tree/symbols) | Yes, but only one file | `pokeemerald.sym` | One ROM (English, `sha1 f3ae0881...`). The README lists only that ROM. A separate `multi-language` branch exists; its contents were not inspected (unverified). | No LICENSE file |
| [pret/pokefirered](https://github.com/pret/pokefirered/tree/symbols) | Yes, `.sym` only | `pokefirered`, `pokefirered_rev1`, `pokefirered_switch`, and the same three for `pokeleafgreen` | FireRed and LeafGreen, base, rev1, and rev10 (the Switch release build, `GAME_REVISION=10`). Selected by Makefile target (`firered_rev1`, `firered_switch`). English only in the Makefile. | No LICENSE file |

Sources: branch and file listings from `gh api repos/pret/<repo>/contents?ref=symbols`; Makefiles at `https://raw.githubusercontent.com/pret/<repo>/master/Makefile`. License check: the root tree of pokeemerald has no LICENSE or COPYING file, the GitHub API reports no license for any of the seven repos, and the READMEs contain no license text. Only bundled third-party tools carry headers (for example `tools/gbafix/gbafix.c` is GPL v2 or later, `tools/jsonproc/inja.hpp` is MIT).

The `symbols` branches are updated by CI. Last commit dates observed: pokered 2026-10-24, pokeyellow 2026-10-31, pokegold and pokecrystal 2026-10-21, pokeruby 2026-09-29, pokeemerald 2026-08-26, pokefirered 2026-06-24. So prebuilt symbols exist for every repo and no local toolchain build is needed to get them.

## Symbol file formats

- Game Boy repos (rgblink output): lines like `00:d16b wPartyMon1Species`, meaning `bank:address label`. Sample from `pokered.sym` on the `symbols` branch: `00:d163 wPartyCount`, `00:d16b wPartyMons`, `00:d014 wBattleMon`, `00:cfe5 wEnemyMon`, `00:da96 wBoxMons`. There is no size column, so a field or array length must come from the next label or from the source. The `.map` file adds section sizes.
- GBA repos (objdump based, produced by the `make syms` target): lines like `02024284 g 00000258 gPlayerParty`, meaning `address scope size name`. Sizes are present for most data symbols. In `pokeruby` many sizes are `00000000` (for example `gBattleMons`, `gBattleTypeFlags`), so sizes are not reliable there.
- The `.sym` includes local symbols (`l`) as well as globals (`g`), so static variables like `sTrainerId` appear too.
- Format sources: the `symbols` branch files themselves and the `syms` rule in the pokeemerald and pokefirered Makefiles.

## Struct layout extraction

- Gen 3 non-modern builds always compile with `-g` in pokeemerald (`CFLAGS += -g` unless modern), and pokefirered and pokeruby gate it behind `DINFO=1` or have it in `CC1FLAGS` (per the Makefiles). The ELF is not published on any `symbols` branch, only the `.sym`. So DWARF-based layout extraction would require a local build with agbcc and devkitARM. That build is feasible but heavy, and it ties the profile generator to each repo's toolchain.
- The layouts themselves live in headers: `include/global.h` (SaveBlock1, SaveBlock2), `include/pokemon.h` (BoxPokemon, Pokemon, substructs), `include/pokemon_storage_system.h`, `include/battle.h` (BattlePokemon). These are plain C structs, so a C parser or hand transcription both work. Substructure shuffling in Gen 3 (the 24 orderings of the four 12-byte substructs) and encryption are in `src/pokemon.c` logic, not in any symbol data, and must be coded by hand.
- Game Boy repos define structs with RGBDS macros in `macros/` and `wram.asm`, for example per-mon offsets via `wPartyMon1Species` ... `wPartyMon1Level` labels and `box_struct` or `party_struct` macros. The `.sym` gives only field labels for the first slot. Layout needs a manual read of those assembly macros; no mechanical tool is provided.
- Conclusion: symbols give where each structure starts. Field offsets inside structs come from the source headers and are identical across revisions of the same game family for most structs, so they can be written once per generation and shared by profiles.

## Save block pointers

- Emerald and FireRed relocate the save blocks. In `pokeemerald.sym`: `03005d8c g 00000004 gSaveBlock1Ptr`, `03005d90 ... gSaveBlock2Ptr`, `03005d94 ... gPokemonStoragePtr`. These are IWRAM pointers; the real address is read at runtime. The `.sym` has no `gSaveBlock1`/`gSaveBlock2` data symbols for Emerald, since the blocks live in the heap.
- In `pokefirered.sym`: `03005008 gSaveBlock1Ptr`, `0300500c gSaveBlock2Ptr`, `03005010 gPokemonStoragePtr`, but also static `02024588 g 00000f24 gSaveBlock2` and `0202552c g 00003d68 gSaveBlock1` (sizes 0xF24 and 0x3D68). These are the unrelocated backing arrays. Real data lives where the pointer says, so profiles should store the pointer address and read through it.
- Ruby and Sapphire do not relocate: `pokeruby.sym` has `02024ea4 gSaveBlock2` (0x890), `02025734 gSaveBlock1` (0x3ac0), `020300a0 gPokemonStorage` (0x83d0), `03004360 gPlayerParty` (0x258).
- All checked from the `symbols` branch files.

## Battle variables

Present as named globals in the GBA symbols. Examples from `pokeemerald.sym`: `02022fec gBattleTypeFlags`, `02024064 gActiveBattler`, `0202406c gBattlersCount`, `02024084 gBattleMons` (0x160 bytes, four 0x58 battlers), `0202433a gBattleOutcome`, `0202449c gBattleStruct` (pointer), `020244a8 gBattleResources` (pointer), `020244ec gPlayerParty` (0x258, six 0x64 Pokemon), `02024744 gEnemyParty`, `020244e9 gPlayerPartyCount`. FireRed has `02022b4c gBattleTypeFlags`, `02023be4 gBattleMons`, `02024284 gPlayerParty`. Pointers such as `gBattleStruct` and `gBattleResources` point into heap memory and need a read at runtime, like the save block pointers.

In Game Boy repos battle state is plain WRAM labels (`wBattleMon`, `wEnemyMon`, `wBattleMonSpecies`), covering both sides.

## Address differences across revisions

The FireRed EWRAM symbols checked (`gBattleMons`, `gPlayerParty`, save block pointers) matched across base, rev1, and LeafGreen in the lines I compared. Ruby IWRAM `gPlayerParty` differs for the German build (`03004370` versus `03004360`). So revisions can share RAM addresses or not, and ROM-space addresses (functions, tables) do differ. A generator should emit one profile per symbol file instead of assuming equality. Full diffing of all revisions was not done.

## ROM hacks, CFRU, and DPE

- [Skeli789/Complete-Fire-Red-Upgrade](https://github.com/Skeli789/Complete-Fire-Red-Upgrade) does not build from the pokefirered decomp. Its README tells you to place a base `BPRE0.gba` in the folder, set `OFFSET_TO_PUT` in `scripts/make.py`, and run the Python build. The output is `test.gba` plus an `offsets.ini` (per README). It injects compiled code into free space of a vanilla FireRed 1.0 US ROM.
- The linker script `BPRE.ld` (2069 lines at last check) lists vanilla addresses CFRU depends on and the new RAM it adds, for example `gBattleSandsStreaks = 0x202682C;`, `gLastUsedBall = 0x203B774;`. This is the nearest thing to a CFRU symbol file, but it covers only what CFRU references, not the full game.
- A hack's final addresses (where the code and tables landed) are in the author's `offsets.ini` for their build. Whether Radical Red publishes its `offsets.ini` or any symbols was not found (unverified). A forum thread titled "Pokemon Radical Red offsets needed" suggests users resort to hex editing ([PokeCommunity](https://www.pokecommunity.com/threads/pokemon-radical-red-offsets-needed.531541/latest)); content not read.
- [Skeli789/Dynamic-Pokemon-Expansion](https://github.com/Skeli789/Dynamic-Pokemon-Expansion) has the same layout (`BPRE.ld`, `repoints`, `hooks`) and is a smaller Gen 3 expansion for FireRed.
- RAM layout changes in CFRU: because it injects onto vanilla FireRed 1.0, the original `gPlayerParty` and save block locations from the pokefirered base symbols still apply, with additions placed in unused EWRAM. Party size, Pokemon struct, and box size changes (CFRU expands some tables) were not verified here; treat any hack as needing its own profile that is checked against the running game.
- Licenses: CFRU has no LICENSE file in the root tree, and its README forbids making money from anything derived from it. DPE ships a WTFPL-style license (`LICENSE`, GitHub reports NOASSERTION). Both are unmaintained recently (last push 2025-01 and 2024-01).

## Existing projects that generate address tables from symbols

None found. A web search for tools that turn pret `.sym` files into RAM address tables returned only the pret `tools/unnamed.py` (reads `pokered.sym` to list unnamed symbols), general debugger guidance saying emulators can load the `.sym`, and Data Crystal / Glitch City RAM maps that are manually written. This is a negative result from one search, not proof of absence.

## Licensing and bundling in a GPL program

- No pret repo in the set has a LICENSE file, so there is no explicit grant. The repos are decompiled Nintendo / Game Freak code; the pret README points to pret.github.io for contact only.
- Derived facts such as an address, an offset, or a struct field order are factual data, and bundling an address table generated from symbols is a different thing from copying source. This is a reasoning, not legal advice, and the position should be confirmed (unverified).
- Reduce risk by not copying source text, comments, or names beyond what is needed to identify a field. Record the repo and commit hash a profile was generated from. Keep the generator script in the repo and treat generated JSON as data.
- CFRU forbids commercial use of its assets; DPE is WTFPL. Neither affects a table of vanilla FireRed addresses. A table of CFRU-added addresses would inherit the CFRU README terms; a GPL program is not commercial by itself but this should be avoided if possible.

## Recommendation

1. Generate profiles from the pret `symbols` branches. Pull the `.sym` for each revision, keep only the whitelist of symbols the reader needs (party, enemy party, storage, save block pointers, battle globals, key WRAM labels), and write them into a per-ROM JSON profile. Record repo, branch, and commit.
2. Write struct layouts by hand once per generation (Gen 1, Gen 2, Gen 3), from the headers and RGBDS macros. Do not depend on DWARF; the ELFs are not published and a build adds a toolchain dependency.
3. In the profile, mark pointer-style symbols (`gSaveBlock1Ptr`, `gSaveBlock2Ptr`, `gPokemonStoragePtr`, `gBattleStruct`, `gBattleResources`) as pointers to dereference, and plain arrays as direct.
4. Treat ROM hacks as separate profiles built by hand or from the author's offsets; CFRU's `BPRE.ld` and `offsets.ini` are useful inputs but there is no general symbol file.
5. Get a decision on licensing before bundling: use factual addresses only and record provenance.
6. Gaps: no non-English or Japanese builds (except the Ruby/Sapphire German, Crystal AU); Emerald has one revision on the `symbols` branch; non-US Gen 1 and Gen 2 releases are not covered by pret.
