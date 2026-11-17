# CFRU header repoints without DPE (facts for ticket 023)

Source: Skeli789/Complete-Fire-Red-Upgrade at b637a27898b14e25dd24d0f69a3e302f0069deb8 (2025-01-24), shallow-cloned to /tmp and read locally. Base URL: https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/b637a27898b14e25dd24d0f69a3e302f0069deb8/

## Verdict

CFRU without DPE rewrites 2 of the 6 header words directly (0x1C0 gAbilityNames, 0x1CC gBattleMoves) and, by a side effect of its repoint-all scan, very likely a third (0x148 move names). It does not rewrite 0x144, 0x1BC or 0x1C8; it only reads them at runtime through rom_locs.h.

## Per-word table

| Header word | Field (GF header) | In repoints/repointall? | Defining CFRU symbol | Applied how |
|---|---|---|---|---|
| 0x08000144 | monSpeciesNames | No | None. gSpeciesNames is a macro that reads the word at runtime | Never written |
| 0x08000148 | moveNames | Not by header address. Indirectly via `gMoveNames 0804EF84` | strings/attack_name_table.string:4 (`#org @gMoveNames`) | Unconditional, but by value match (see facts) |
| 0x080001BC | speciesInfo | No | None. gBaseStats is a macro reading the word at runtime; BPRE.ld:401 also pins `gBaseStats = 0x8254784` (vanilla) | Never written |
| 0x080001C0 | abilityNames | Yes, repointall:6 `gAbilityNames 080001C0` | strings/ability_name_table.string:4 (`#org @gAbilityNames`) | Unconditional (if symbol exists) |
| 0x080001C8 | items | No | None. gItems is a macro reading the word at runtime | Never written |
| 0x080001CC | moves | Yes, repointall:3 `gBattleMoves 080001CC` | src/Tables/battle_moves.c:11 (`const struct BattleMove gBattleMoves[]`) | Unconditional (if symbol exists) |

Related: repoints:6 `gAbilityDescriptions 080001C4` and repointall:9-10 `gBallSpriteSheets 080001D0`, `gBallSpritePalettes 080001D4` (adjacent header words, not asked).

## Facts

- (confirmed) repointall holds 17 lines; the relevant ones are line 3 `gBattleMoves 080001CC`, line 4 `gMoveNames 0804EF84`, line 6 `gAbilityNames 080001C0`. No 0x144, 0x1BC or 0x1C8 entry exists. https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/b637a27898b14e25dd24d0f69a3e302f0069deb8/repointall#L3-L6
- (confirmed) grep of `repoints` (308 lines) for 0x144/0x148/0x1BC/0x1C0/0x1C8/0x1CC and for gBaseStats/gSpeciesNames/gItems/gMoveNames/gAbilityNames/gBattleMoves finds only `gAbilityDescriptions 080001C4` (line 6). https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/b637a27898b14e25dd24d0f69a3e302f0069deb8/repoints#L6
- (confirmed) scripts/insert.py reads repointall with no conditional gating of its own: it parses `symbol address`, skips lines whose symbol is already in generatedrepoints, looks the symbol up in the `nm build/linked.o` table, prints `Symbol missing:` and continues if absent, else queues it. repointall has no `#ifdef`, so there is no config flag. https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/b637a27898b14e25dd24d0f69a3e302f0069deb8/scripts/insert.py#L331-L355
- (confirmed) repointall semantics are NOT "write the new pointer at the given address". RealRepoint reads the vanilla pointer stored at the given address in the SOURCE rom, then scans every 4-aligned word of the rom (0 to 0xFFFFFD, skipping the inserted code area and 3 ignored offsets) and overwrites every word equal to that vanilla pointer with the new symbol address. https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/b637a27898b14e25dd24d0f69a3e302f0069deb8/scripts/insert.py#L163-L196 (comment at repointall:1-2 states the same)
- (confirmed) Consequence for 0x1CC and 0x1C0: the header word itself holds the vanilla pointer, so it is one of the matched words and gets rewritten, plus every code literal-pool copy.
- (inferred) Consequence for 0x148: line 4 uses code address 0x0804EF84 as the lookup source. In vanilla BPRE gMoveNames is 0x8247094 (BPRE.ld:389 comment). Anchor 0x0804EF84 is a literal-pool word that most likely holds 0x08247094, and header 0x148 holds the same value, so the scan rewrites 0x148 too. Not verified against a ROM (none available here). Open gap.
- (confirmed) The symbols come from the CFRU build: gMoveNames and gAbilityNames are emitted as `.global` labels by scripts/string.py:185/206 from `#org @name` lines; gBattleMoves is a plain C table. https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/b637a27898b14e25dd24d0f69a3e302f0069deb8/strings/attack_name_table.string#L4 ; .../strings/ability_name_table.string#L4 ; .../src/Tables/battle_moves.c#L11. Neither string file nor the repointall path has an `#if`; battle_moves.c has `#ifdef DYNAMAX_FEATURE` only around later sub-blocks (lines 13355, 15007), not the table.
- (confirmed) GetSymbols keeps only nm types t/d; linker.ld puts `*(.rodata)` inside the `.text` section (linker.ld:9-18), so const tables are `t` and are found.
- (confirmed) CFRU never defines a species-names, base-stats or items table to repoint: include/new/rom_locs.h:9,12,13 define `gItems`, `gSpeciesNames`, `gBaseStats` as `*((u32*) 0x80001C8 / 0x8000144 / 0x80001BC)`, dereferencing the header word at runtime so a DPE-expanded ROM works without CFRU changes. https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/b637a27898b14e25dd24d0f69a3e302f0069deb8/include/new/rom_locs.h#L9-L13
- (confirmed) CFRU src/config.h marks DPE as optional (e.g. `EXPAND_MOVESETS` "Comment this out if you're using the Dynamic Pokemon Expansion", line 230); README.md:77 links DPE as a separate repo. So a no-DPE build is a supported configuration and the above is what it does.
- (inferred) With no DPE, gBaseStats/gSpeciesNames/gItems stay at vanilla locations (0x8254784 base stats per BPRE.ld:401), but gBattleMoves, gAbilityNames and (likely) gMoveNames move to CFRU-inserted tables, so header 0x1CC/0x1C0 (+0x148) differ from vanilla after a CFRU build. Moves and ability names are also at expanded size (CFRU ability_name_table.string MAX_LENGTH=16, moves MAX_LENGTH=12).

## BPRE GF header offsets (pokefirered src/rom_header_gf.c)

- (confirmed) struct GFRomHeader field order from https://github.com/pret/pokefirered/blob/master/src/rom_header_gf.c#L10-L77, compiled with gcc `offsetof` on a transcription, adding the 0x100 header base: monSpeciesNames 0x144, moveNames 0x148, speciesInfo 0x1BC, abilityNames 0x1C0, abilityDescriptions 0x1C4, items 0x1C8, moves 0x1CC, ballGfx 0x1D0. gItems = 0x1C8 and gBattleMoves = 0x1CC confirmed.
- (confirmed) Independent cross-check: CFRU's own rom_locs.h reads gItems at 0x80001C8, and its repoints/repointall use 0x1C4, 0x1CC, 0x1C0, 0x1D0, 0x1D4 for BPRE.
- (inferred) Emerald comparison: pokeemerald rom_header_gf.c has the same field order for speciesInfo/abilityNames/items/moves (lines 153-157) and the same offsets by the same 0x100 base logic; offsets not recomputed for Emerald. Base 0x100 for the GF header is assumed from the BPRE addresses CFRU uses (0x80001xx), not read from the ld script.

## Open gaps

1. 0x148 rewrite depends on ROM word at 0x0804EF84 equalling the vanilla 0x148 value; needs a BPRE 1.0 dump to confirm.
2. Not tested by running the CFRU build (needs devkitARM and a ROM); conclusions are from reading scripts/insert.py.
3. Master branch not diffed against b637a27898 (clone HEAD at pin only; pin is the 2025-01-24 commit).
