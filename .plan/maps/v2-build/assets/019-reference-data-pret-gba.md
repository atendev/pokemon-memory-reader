# Reference data in the pret GBA decompilations (019, Gen 3)

Repos and commits read (all `master`, fetched 2026-11-13): pret/pokeruby `5784633ce4ef7ade1a7f2d2d0c288e3d5e6cdd7f`, pret/pokeemerald `731ad5bfd6e6f265508d0efcca0ba42f9dcf5881`, pret/pokefirered `ce6406d8c2eaf46d543c8a2606de0c3cb1951982`.

The research subagent fetched the files and stopped at an API rate limit before it wrote notes. The main thread then ran three small Python scripts over the fetched files on 2026-11-14. Every count below comes from those scripts. Nothing here was copied into the repo except the short example lines.

## 1. Names

- Species: `src/data/text/species_names.h` in all three repos. Example: `[SPECIES_TREECKO] = _("TREECKO"),`. Each repo has 412 entries, uppercase in-game text, keyed by `SPECIES_*` constants.
- Moves: `src/data/text/move_names.h`, 355 entries in each repo.
- Abilities: `src/data/text/abilities.h` in pokeemerald and pokefirered (`[ABILITY_STENCH] = _("STENCH"),`, 78 lines). pokeruby keeps them in an assembly include as `.string "STENCH$", 13` lines.
- Items: pokeemerald `src/data/items.h` and pokeruby `src/data/items.h` hold `.name = _("MASTER BALL")` next to `.itemId = ITEM_MASTER_BALL`. pokefirered keeps items in `src/data/items.json`. Item counts are 349 (Ruby/Sapphire), 375 (FireRed/LeafGreen) and 377 (Emerald).
- How the script resolved item IDs: pokeruby's and pokefirered's `include/constants/items.h` use plain `#define ITEM_X <number>` lines (349 and 375 IDs), and the script mapped each repo's item names to numeric IDs through them. pokefirered's names come from `src/data/items.json`, keyed by the `itemId` constant.
- pokeemerald's `include/constants/items.h` doesn't use plain `#define ITEM_X <number>` lines, so the script compared Emerald's items by list position instead of by constant value (unverified that position equals ID, though the other two repos agree with it at every position).

## 2. Do the games agree?

- Species names match for all 412 constants across the three repos.
- Move names match for all 355 constants. The only difference is the placeholder text of `MOVE_NONE`.
- Ability names match line for line.
- Item names match at every shared position. Emerald's list is a superset. Positions 349 to 374 are the FireRed/LeafGreen key items (`OAK'S PARCEL` to `SAPPHIRE`), and 375 and 376 are Emerald's (`MAGMA EMBLEM`, `OLD SEA MAP`). Ruby/Sapphire ends at 348.
- Item constant names differ at 61 IDs, such as `ITEM_TM01_FOCUS_PUNCH` in pokeruby against `ITEM_TM01` in pokefirered. Only the constant names differ, not the item text.

## 3. Charmap

- `charmap.txt` at each repo root. pokeemerald's has 1,089 lines, and 161 of them map kana, such as `'あ' = 01`. Latin characters use the same byte values, so the file holds two character sets.
- How the file tells the two sets apart was not checked.

## 4. Species data and National Dex numbers

- Species data lives in `src/data/pokemon/species_info.h` (pokeemerald, pokefirered) and `src/data/pokemon/base_stats.h` (pokeruby). Their field formats were not checked.
- pokeemerald's `src/pokemon.c` has 412 `SPECIES_TO_NATIONAL(` entries, which map internal species IDs to National Dex numbers through `NATIONAL_DEX_*` constants.

## 5. Move data

- `src/data/battle_moves.h` (pokeemerald, pokefirered) and a `battle_moves.c` file in pokeruby. Their field formats were not checked.

## 6. Map sections (met locations)

- `src/data/region_map/region_map_sections.json` in each repo. The lists have 88 entries (pokeruby), 213 (pokeemerald) and 197 (pokefirered).
- pokefirered lists the Hoenn sections with no name. For example, `MAPSEC_ROUTE_119` has `"name": null`.
- Emerald has 16 sections that FireRed lacks.
- Seven sections sit at different list positions: `MAPSEC_UNDERWATER_125` (207 in pokeemerald, 51 in pokefirered), `MAPSEC_UNDERWATER_126`, `MAPSEC_UNDERWATER_127`, `MAPSEC_UNDERWATER_128`, `MAPSEC_BIRTH_ISLAND` (200, 187), `MAPSEC_ALTERING_CAVE` (210, 183) and `MAPSEC_NAVEL_ROCK` (211, 174). Whether list position equals the numeric section ID was not checked.
- pokeruby's names contain control codes, such as `LITTLEROOT{NAME_END} TOWN`.

## 7. SHA-1 files

- pokeemerald has `rom.sha1` with one line, `f3ae088181bf583e55daf962a92bb46f4f1d07b7  pokeemerald.gba`. pokeruby and pokefirered have one `<build>.sha1` file per build. [The hash research](./019-reference-data-hashes.md) covers them all.

## 8. Experience tables

- `src/data/pokemon/experience_tables.h` defines six formula macros, `EXP_ERRATIC`, `EXP_FAST`, `EXP_FLUCTUATING`, `EXP_MEDIUM_FAST`, `EXP_MEDIUM_SLOW` and `EXP_SLOW`. pret computes the Gen 3 tables from formulas, not from literal numbers.

## Open gaps

- The species data and move data field formats.
- How `charmap.txt` separates the Latin and kana sets.
- Whether map-section list position equals the numeric ID.
- What pokeemerald's `multi-language` branch holds. Not needed while v2.0 ships English only.
