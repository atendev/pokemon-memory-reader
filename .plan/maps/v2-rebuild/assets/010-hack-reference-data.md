# Hack reference data: where extended name tables live

Researched against source checkouts of Skeli789/Complete-Fire-Red-Upgrade (CFRU, last commit 2025-01-24), Skeli789/Dynamic-Pokemon-Expansion (DPE, last commit 2022-01-17), rh-hideout/pokeemerald-expansion (HEAD at research time) and pret/pokefirered. Nothing here was checked against a real hack ROM; Radical Red and other closed-source hacks are inferred from the CFRU source they build on.

## 1. The vanilla GF ROM header is the common entry point

Vanilla FireRed/LeafGreen/Emerald carry a table of pointers at the start of ROM (struct `GFRomHeader`, pret `src/rom_header_gf.c`). Relevant fields, in order, after `version` (u32), `language` (u32) and `gameName[32]`:

| Field | Header offset (FR/LG, derived from struct order; matches CFRU repoint lists) |
|---|---|
| `monSpeciesNames` | `0x08000144` (confirmed: CFRU/DPE `repointall` line `gSpeciesNames 08000144`) |
| `moveNames` | `0x08000148` (derived; CFRU does NOT list it in `repointall`, see caveats) |
| `speciesInfo` (base stats) | `0x080001BC` (confirmed: `gBaseStats 080001BC`) |
| `abilityNames` | `0x080001C0` (confirmed) |
| `abilityDescriptions` | `0x080001C4` (confirmed in CFRU `repoints`) |
| `items` | `0x080001C8` (derived) |
| `moves` (battle move data) | `0x080001CC` (confirmed: `gBattleMoves 080001CC`) |
| `pokemonNameLength1/2` | a byte pair in the middle of the header (name length constant) |

Each pointer is a 4-byte little-endian ROM address (`0x08xxxxxx`). An adapter that can read cartridge address space reads the pointer, then the table. Header offsets for non-FR games differ; Emerald's struct has the same shape and pokeemerald-expansion still fills it (`.speciesInfo`, `.items`, `.moves`), but comments out name pointers that moved into info structs.

Sources:
- [pokefirered `src/rom_header_gf.c`](https://github.com/pret/pokefirered/blob/master/src/rom_header_gf.c)
- [pokeemerald-expansion `src/rom_header_gf.c`](https://github.com/rh-hideout/pokeemerald-expansion/blob/master/src/rom_header_gf.c)
- [CFRU `repointall`](https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/master/repointall) and [`repoints`](https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/master/repoints)
- [DPE `repointall`](https://github.com/Skeli789/Dynamic-Pokemon-Expansion/blob/master/repointall)

## 2. CFRU / DPE hacks (Radical Red and similar)

- **Species names.** DPE `strings/Pokemon_Name_Table.string` defines `#org @gSpeciesNames` with `MAX_LENGTH=10` and `FILL_FF=True`: a flat array of fixed-width 11-byte entries (10 chars plus 0xFF terminator, padded with 0xFF), indexed by species ID. DPE inserts it at a dynamic free offset and rewrites the header pointer at `0x08000144`. CFRU's `include/data2.h` declares `gSpeciesNames[][POKEMON_NAME_LENGTH + 1]`. CFRU species IDs reach at least `0x4F9` (`SPECIES_MELMETAL_GIGA`), so the table has well over 1000 entries and IDs are u16. Forms are real species IDs (no separate form table for names).
  - [DPE `strings/Pokemon_Name_Table.string`](https://github.com/Skeli789/Dynamic-Pokemon-Expansion/blob/master/strings/Pokemon_Name_Table.string)
  - [CFRU `include/data2.h`](https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/master/include/data2.h), [`include/constants/species.h`](https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/master/include/constants/species.h)
- **Move names.** CFRU `strings/attack_name_table.string` defines `#org @gMoveNames` with `MAX_LENGTH=12`, `FILL_FF=True`: fixed 13-byte entries indexed by move ID (`MOVE_NAME_LENGTH 12`). The in-code references to this table are repointed through literal pools (`gMoveNames 0804EF84` in `repointall`), not through the header, so header `0x08000148` may still point at the old vanilla table. A profile must not trust the header for move names in CFRU hacks without checking.
  - [CFRU `strings/attack_name_table.string`](https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/master/strings/attack_name_table.string)
- **Ability names.** CFRU `strings/ability_name_table.string`, `MAX_LENGTH=16` (vanilla is 12; `ABILITY_NAME_LENGTH 16 //Was 12 in vanilla`), pointer at header `0x080001C0` is repointed.
- **Item names.** Item names are the first field of `struct Item` (`u8 name[14]`, followed by `itemId`, `price`, hold effect, description pointer, ...; stride 0x2C in vanilla), found through the header pointer `0x080001C8` or the hack's item table. CFRU source references `gItems[...]` and extends `ITEM_*` IDs to at least `0x213`, but its repoint lists do not mention `gItems` and no item name `.string` file exists in the repo, so how a given hack relocates items is not established here.
  - [CFRU `include/item.h`](https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/master/include/item.h), [`include/constants/items.h`](https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/master/include/constants/items.h), [`src/item.c`](https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/master/src/item.c)
- **Location is hack-specific.** CFRU inserts at `OFFSET_TO_PUT` (set in `scripts/make.py`) and writes `offsets.ini` at build time. The final addresses of tables are not fixed across hacks and are not published in the repo ([README](https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/master/README.md)). Linker file `BPRE.ld` holds only vanilla BPRE (FireRed 1.0 US) addresses, e.g. `gPokemonNames = 0x8245EE0`, `gMoveNames = 0x8247094`, `gAbilityNames = 0x824FC40`, `gBaseStats = 0x8254784` (the last three commented or vanilla), which tells where the vanilla originals sit.
- **Which hacks are in reach.** CFRU and DPE are FireRed-only (`BPRE`). Radical Red and Unbound are widely reported to be CFRU-based, but this research did not find a primary source stating that; the CFRU README's "Used by" section is empty. Both are distributed as patches over a user-supplied FireRed ROM, and their final tables were not inspected.

## 3. Decomp-based hacks (pokeemerald-expansion, pokefirered forks)

- **Source layout.** In pokeemerald-expansion names are fields in per-entry info structs, not standalone arrays:
  - Species: `struct SpeciesInfo` holds `u8 speciesName[POKEMON_NAME_LENGTH + 1]` inline, in `gSpeciesInfo[]` (`include/pokemon.h`, data in `src/data/pokemon/species_info/*.h`). `POKEMON_NAME_LENGTH` is 12 here (vanilla 10). The struct size changes with config flags, so the stride must come from a build map or the symbol file, not from a constant.
  - Moves: `struct MoveInfo` starts with `const u8 *name` (pointer to a string elsewhere in ROM), array `gMovesInfo[]`; `MOVE_NAME_LENGTH` 16.
  - Items: `struct ItemInfo` has `const u8 *name` (and `pluralName`), array `gItemsInfo[]`; `ITEM_NAME_LENGTH` 20.
  - Abilities: `struct AbilityInfo` has `u8 name[ABILITY_NAME_LENGTH + 1]` inline.
- **Header.** The expansion's GF header still sets `.speciesInfo = gSpeciesInfo`, `.items = gItemsInfo`, `.moves = gMovesInfo` (its `monSpeciesNames` / `moveNames` / `abilityNames` lines are commented out as "handled in gSpeciesInfo / gMovesInfo / gAbilitiesInfo"), and it publishes `pokemonNameLength1/2`. So a reader gets the table base from the header but still needs entry stride and field offsets for each hack build.
- **Which hacks are in reach.** Any hack that ships a `.sym`/`.map` file or whose author publishes symbols, or a profile maintained per hack. Emerald-based expansion hacks that publish source can be turned into profiles from a build; closed ROMs cannot. Not surveyed: Run and Bun and similar named hacks; no primary source for their layouts was read.
  - [pokeemerald-expansion `include/pokemon.h`](https://github.com/rh-hideout/pokeemerald-expansion/blob/master/include/pokemon.h), [`include/move.h`](https://github.com/rh-hideout/pokeemerald-expansion/blob/master/include/move.h), [`include/item.h`](https://github.com/rh-hideout/pokeemerald-expansion/blob/master/include/item.h), [`include/constants/global.h`](https://github.com/rh-hideout/pokeemerald-expansion/blob/master/include/constants/global.h)

## 4. Text encoding

All of these use the Gen 3 proprietary character map, 0xFF as terminator; the Western map is in CFRU `charmap.tbl` (`00= `, `01=À` ...) and pokeemerald-expansion `charmap.txt`. Fixed-width tables are padded with 0xFF (`FILL_FF=True`). The expansion adds no new encoding; extended names use the same charmap. Names are therefore decodable with the Gen 3 character map the project already needs for nicknames and player names.
- [CFRU `charmap.tbl`](https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/master/charmap.tbl), [pokeemerald-expansion `charmap.txt`](https://github.com/rh-hideout/pokeemerald-expansion/blob/master/charmap.txt)

## 5. Can names be read live from the ROM image in emulated memory?

Yes in principle: the GBA maps cartridge ROM at `0x08000000` (Bulbapedia notes a ROM file offset is the low six hex digits of a `0x08xxxxxx` address), so any adapter whose bridge can read bus address `0x08xxxxxx` can read the header, follow pointers and read the tables. Whether each emulator API exposes that region was not part of this question and is the concern of ticket 001 and its follow-ups; RAM-only access (EWRAM/IWRAM) would not reach it. Key limits:

1. Header pointers are reliable for species names and abilities in CFRU hacks, unreliable for move names (not repointed) and unknown for items.
2. Expansion builds need per-build stride/offset data (struct sizes vary with config).
3. Trust of unknown hacks: a profile that reads the header must bound entries (table length unknown; derive from highest species/move ID the decoder sees or from a profile-declared count).
4. Where a hack's table address is known (from a profile), a one-time ROM read at attach time could cache the names for the session, avoiding shipping any name data for that hack.

## 6. Shipping alternative

Fixed-width name arrays from CFRU's `.string` sources and expansion's `gSpeciesInfo`/`gMovesInfo`/`gItemsInfo` data can be flattened to JSON arrays (`id -> name`) per hack, keyed by profile ID, as ordinary reference data. This needs the hack's source or a one-time dump from the user's ROM; ROMs themselves are never committed (map Notes).

## Open gaps (not verified)

- Real Radical Red / Unbound / Run and Bun table addresses and whether header pointers are kept consistent.
- Whether CFRU hacks relocate the item table via header `0x080001C8`.
- Whether mGBA, RetroArch and BizHawk expose `0x08000000+` reads to their bridges/commands.
- The CFRU Documentation PDF/DOCX in the repo may state more about layout; not read.
