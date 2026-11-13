# Pokemon schema facts in CFRU and DPE

Research for the ticket "What is the full Pokemon schema?". Checked on 2026-11-13. Sources are read at CFRU `master` `b637a27898b14e25dd24d0f69a3e302f0069deb8` (repo last pushed 2025-01-24) and DPE `master` `cdfc053a56326a13dc5311b24488445e17536b7e` (repo last pushed 2024-01-03). Paths below are relative to each repo root. Permalinks use `https://github.com/Skeli789/<repo>/blob/<sha>/<path>`. Claims marked **inferred** were not read in source; claims marked **unverified** could not be checked in a primary source. No recommendations here.

CFRU targets one ROM only: `BPRE.ld` holds FireRed US 1.0 addresses. Every ROM address below is for that ROM.

## Summary

| # | Fact | Answer |
|---|---|---|
| 1 | Types | 0x00 to 0x11 vanilla order with MYSTERY at 0x09, ROOSTLESS 0x13, BLANK 0x14, FAIRY 0x17. `NUMBER_OF_MON_TYPES` is 0x18. The battle mon has a `type3` byte at +0x18. |
| 2 | Move table | `gBattleMoves`, 12-byte entries. Type at +0x02, base PP at +0x04. The padding bytes hold z-move power, split and z-move effect. The pointer sits at ROM address 0x080001CC and is repointed on insert. |
| 3 | Caught ball | One full byte (`pokeball`) in the growth substruct at +0x0A. 28 ball ids (0 to 27, 27 obtainable). Stored value is a CFRU ball id, mapped to items through the item table's `type` byte. |
| 4 | Nature | CFRU always derives nature as personality % 25. No override field. Radical Red unverified (no primary source). |
| 5 | Species info | Confirmed: `type1` at +0x06, `type2` at +0x07. Entry is 0x1C bytes (inferred from alignment). |

## 1. Types

Source: `include/pokemon.h` lines 111 to 133 ([permalink](https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/b637a27898b14e25dd24d0f69a3e302f0069deb8/include/pokemon.h#L111-L133)).

| Id | Constant | Id | Constant |
|---|---|---|---|
| 0x00 | `TYPE_NORMAL` | 0x0B | `TYPE_WATER` |
| 0x01 | `TYPE_FIGHTING` | 0x0C | `TYPE_GRASS` |
| 0x02 | `TYPE_FLYING` | 0x0D | `TYPE_ELECTRIC` |
| 0x03 | `TYPE_POISON` | 0x0E | `TYPE_PSYCHIC` |
| 0x04 | `TYPE_GROUND` | 0x0F | `TYPE_ICE` |
| 0x05 | `TYPE_ROCK` | 0x10 | `TYPE_DRAGON` |
| 0x06 | `TYPE_BUG` | 0x11 | `TYPE_DARK` |
| 0x07 | `TYPE_GHOST` | 0x13 | `TYPE_ROOSTLESS` |
| 0x08 | `TYPE_STEEL` | 0x14 | `TYPE_BLANK` |
| 0x09 | `TYPE_MYSTERY` (the `???` type) | 0x17 | `TYPE_FAIRY` |
| 0x0A | `TYPE_FIRE` | | |

- No constant exists for 0x12, 0x15 or 0x16.
- `NUMBER_OF_MON_TYPES` is defined as `TYPE_FAIRY + 1`, so 0x18 (24). That count includes MYSTERY and the gaps. Real types: 18 (the 17 vanilla ones minus MYSTERY, plus Fairy). `NUM_HIDDEN_POWER_TYPES` is 16.
- Pseudo-types: MYSTERY (0x09), ROOSTLESS (0x13), BLANK (0x14). `IS_BLANK_TYPE(type)` is true for exactly those three (`src/defines_battle.h` line 46).
- ROOSTLESS is the Roost placeholder. `src/end_turn.c` lines 1020 to 1038 turn a ROOSTLESS slot in `type1`, `type2` or `type3` back into `TYPE_FLYING` at end of turn. The first branch there also turns a `TYPE_NORMAL` slot back into Flying. (Read directly; why Normal appears is not explained in that excerpt.)
- BLANK is the empty third type: `src/general_bs_commands.c` lines 1430, 2916 and 5556 and `src/defines_battle.h` line 87 reset `type3` to `TYPE_BLANK`.
- Third type in the battle mon: yes. `struct BattlePokemon` (`include/pokemon.h` lines 432 to 470) has `u8 type3` at +0x18, then a 7-entry `statStages` array at +0x19 (`BATTLE_STATS_NO` is 8, the array is `BATTLE_STATS_NO - 1`), `ability` +0x20, `type1` +0x21, `type2` +0x22. The last field `otId` is at +0x54, so the struct stays 0x58 bytes. **Inferred:** `type3` takes the byte that held the unused HP stage in vanilla's 8-entry stage array (vanilla struct was not read).
- `type3` is battle-only. `struct Pokemon` and `struct BoxPokemon` carry no type field; a party or box mon's types come from species info (fact 5).

## 2. Move data

Sources: `include/pokemon.h` lines 637 to 651 (`struct BattleMove`), `src/Tables/battle_moves.c` line 11 (the table), `repointall` line 3, `scripts/insert.py`.

- Table name: `gBattleMoves`, declared `const struct BattleMove gBattleMoves[]`, indexed by `MOVE_*` with `[MOVE_NONE]` first, filled with designated initializers ([battle_moves.c](https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/b637a27898b14e25dd24d0f69a3e302f0069deb8/src/Tables/battle_moves.c#L11)).
- Entry layout, all single-byte members, so the stride is 12 (0x0C). The stride is **inferred** from 12 one-byte members, which leave no room for padding.

| Offset | Field | Note |
|---|---|---|
| +0x00 | `effect` | |
| +0x01 | `power` | |
| +0x02 | `type` | `TYPE_*` id from fact 1 |
| +0x03 | `accuracy` | |
| +0x04 | `pp` | base PP |
| +0x05 | `secondaryEffectChance` | |
| +0x06 | `target` | |
| +0x07 | `priority` | `s8` |
| +0x08 | `flags` | |
| +0x09 | `z_move_power` | CFRU, in the first vanilla padding byte |
| +0x0A | `split` | CFRU, `SPLIT_*` damage category |
| +0x0B | `z_move_effect` | CFRU, in the third vanilla padding byte |

- CFRU puts three one-byte fields in the three padding bytes: z-move power (+0x09), split (+0x0A) and z-move effect (+0x0B).
- Address exposure: both a repoint and a header pointer.
  - `repointall` line 3 reads `gBattleMoves 080001CC`. The file's own comment says it "repoints all pointers found at given location".
  - `scripts/insert.py`, function `RealRepoint` (lines 163 to 198), reads the pointer stored at that ROM offset in the source ROM, then scans the whole ROM in aligned 4-byte steps and rewrites every word equal to it to the new table address. The word at 0x080001CC is itself one of those words, so in a built ROM the u32 at ROM address 0x080001CC holds the address of the CFRU copy of `gBattleMoves`.
  - The table is inserted at a free-space offset chosen at build time (`OFFSET_TO_PUT`, chosen by `scripts/make.py`), so its address differs per ROM. The build also writes every text and data symbol to `offsets.ini` (`GetSymbols`, line 81 onward; `offsets.ini` write at line 706 onward). `offsets.ini` is a build output, not part of the ROM.
  - `BPRE.ld` has no `gBattleMoves` line, so CFRU does not pin the table to the vanilla address.
- **Inferred:** 0x080001CC is in the vanilla ROM's header pointer block (`gAbilityNames` at 0x080001C0 and `gBallSpriteSheets` at 0x080001D0 are listed in the same `repointall` section). Not shown by any file read here.

## 3. Caught ball

Sources: `include/pokemon.h` lines 196 to 205 and 229 to 241 (substructs), `src/build_pokemon.c` lines 3921 to 3929, `assembly/hooks/pokemon_data_hooks.s`, `repoints` line 154, `hooks` line 252, `include/new/catching.h`, `src/catching.c` lines 823 to 828.

- Where: `struct PokemonSubstruct0` (the 12-byte growth substruct) has `u8 pokeball`. Member order: `species` u16 +0x00, `heldItem` u16 +0x02, `experience` u32 +0x04, `ppBonuses` +0x08, `friendship` +0x09, `pokeball` +0x0A, `unknown` +0x0B. That is 8 bits, one full byte.
- Party mons and box mons share it: `struct Pokemon` starts with a `BoxPokemon`, and the four substructs sit in `BoxPokemon` after `checksum` and `unknown`.
- The vanilla 4-bit ball field in the origins word (`PokemonSubstruct3`) is gone. In CFRU that word reads `metLevel:7`, `metGame:4`, `gigantamax:1`, `blank:3`, `otGender:1`, so the old ball bits are now the Gigantamax flag plus three blank bits.
- Hooks that route vanilla code to the new byte: `GetMonPokeBallHook`, repointed at ROM 0x0803FE70 (`repoints` line 154), calls `GetMonPokeBall`, which returns `data->pokeball`. `SetMonPokeBallHook`, hooked at ROM 0x08040858 (`hooks` line 252), calls `SetMonPokeBall`, which sets `data->pokeball`.
- **Inferred:** the substruct order inside a box mon (personality % 24) and the XOR encryption with `otId ^ personality` are unchanged from vanilla. The substruct union uses six `u16` words as vanilla does, but no encryption code was read.
- Ball count: the `BallTypes` enum in `include/new/catching.h` runs `BALL_TYPE_MASTER_BALL` 0 to `BALL_TYPE_DREAM_BALL` 26, then `BALL_TYPE_DYNAMAX_BALL` 27 (commented "Don't give to player!"). That is 28 ids, 27 obtainable. `BALL_TYPE_RANDOM = 0xFF` is a selection sentinel, not a stored value.

| Id | Ball | Id | Ball | Id | Ball |
|---|---|---|---|---|---|
| 0 | Master | 10 | Luxury | 20 | Heavy |
| 1 | Ultra | 11 | Premier | 21 | Love |
| 2 | Great | 12 | Dusk | 22 | Friend |
| 3 | Poke | 13 | Heal | 23 | Moon |
| 4 | Safari | 14 | Quick | 24 | Sport |
| 5 | Net | 15 | Cherish | 25 | Beast |
| 6 | Dive | 16 | Park | 26 | Dream |
| 7 | Nest | 17 | Fast | 27 | Dynamax |
| 8 | Repeat | 18 | Level | | |
| 9 | Timer | 19 | Lure | | |

- Stored value to item id:
  - The stored value is the CFRU ball id above, not an item id and not an offset of one.
  - Item to ball: `ItemIdToBallId(item)` returns `ItemId_GetType(item)`, the item table entry's `type` byte (`struct Item`, `include/item.h`, `type` at +0x1B), and returns 27 for the special item value 0xFFFF (`src/catching.c` lines 823 to 828). `ItemId_GetType` is a vanilla ROM function (`BPRE.ld`).
  - Ball to item: CFRU has no function. `BallIdToItemId` is declared in `include/new/catching.h` but the repo has no definition (code search finds only the declaration). `GetBattlerPokeballItemId` returns the stored ball id unchanged. CFRU ships no item rows for balls (`src/Tables/item_tables.c` has none). So the reverse map is a scan of the ROM's item table for `type == ball id` (**inferred**) or a pairing by name.
  - Name pairing with CFRU's item constants (`include/constants/items.h`; CFRU's defaults, a ROM's own table could differ, **unverified**): ids 0 to 11 are items 1 to 12 (`ITEM_MASTER_BALL` 1 to `ITEM_PREMIER_BALL` 12). Then 12 Dusk 0x3C, 13 Heal 0x3D, 14 Quick 0x3E, 15 Cherish 0x35, 16 Park 0x34, 17 Fast 0x26E, 18 Level 0x26F, 19 Lure 0x270, 20 Heavy 0x271, 21 Love 0x272, 22 Friend 0x273, 23 Moon 0x274, 24 Sport 0x275, 25 Beast 0x276, 26 Dream 0x277. Dynamax has no item constant.

## 4. Nature

Sources: `include/pokemon.h` lines 167 to 193 and 688 to 689, `BPRE.ld` lines 486 and 487, `src/build_pokemon.c` lines 2426 to 2462 and 4384 to 4406, plus code searches of the CFRU repo.

- CFRU computes nature from personality only. `GetNature` and `GetNatureFromPersonality` are vanilla ROM functions called through `BPRE.ld` addresses 0x08042E9C and 0x08042EB4. CFRU defines neither one, and `hooks`, `repoints` and `bytereplacement` have no entry for them. `NUM_NATURES` is 25 (the enum runs `NATURE_HARDY` to `NUM_NATURES`).
- To give a mon a chosen nature CFRU rerolls the personality: `GiveMonNatureAndAbility` loops on `Random32()` until `GetNatureFromPersonality(personality)` equals the wanted nature. It can also keep gender, set the ability bit, or force shininess. `CreateMonWithNatureLetter` does the same. So in CFRU nature always equals personality % 25.
- No stored override field: code searches of the CFRU repo for `hiddenNature` return nothing, and `mint` matches only unrelated files (`BPRE.ld`, `battle_anims.c`, `battle_anim.h`). The structs have unnamed spare bits (`PokemonSubstruct0.unknown`, `BoxPokemon.unknown` u16 at +0x1E, `PokemonSubstruct3.blank:3`), but no CFRU code was found using one as a nature.
- Radical Red: **unverified.** Its source is not part of CFRU or DPE, and no primary source for any Radical Red mint or nature storage was read. See Gaps.

## 5. Species info

Sources: CFRU `include/pokemon.h` lines 510 to 541 ([permalink](https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/b637a27898b14e25dd24d0f69a3e302f0069deb8/include/pokemon.h#L510-L541)), DPE `include/base_stats.h` ([permalink](https://github.com/Skeli789/Dynamic-Pokemon-Expansion/blob/cdfc053a56326a13dc5311b24488445e17536b7e/include/base_stats.h)), DPE `src/Base_Stats.c`, DPE `repointall`.

- Confirmed in both repos: `struct BaseStats` has `type1` at +0x06 and `type2` at +0x07, after six one-byte base stats at +0x00 to +0x05 (HP, Attack, Defense, Speed, SpAttack, SpDefense, in that order).
- Rest of the layout (identical in both): `catchRate` +0x08, `expYield` +0x09, EV yields as 2-bit fields in +0x0A and +0x0B, `item1` +0x0C, `item2` +0x0E, `genderRatio` +0x10, `eggCycles` +0x11, `friendship` +0x12, `growthRate` +0x13, `eggGroup1` +0x14, `eggGroup2` +0x15, `ability1` +0x16, `ability2` +0x17, `safariZoneFleeRate` +0x18, `bodyColor` (7 bits) and `noFlip` (1 bit) +0x19, `hiddenAbility` +0x1A.
- Entry size: 0x1C. **Inferred:** members end at +0x1A (0x1B bytes) and `u16` members force 2-byte alignment, which pads the struct to 0x1C. No file read states the size.
- The table is `const struct BaseStats gBaseStats[]` in DPE `src/Base_Stats.c`, indexed by `SPECIES_*`, with `[SPECIES_NONE] = {0}` first. DPE's `repointall` line `gBaseStats 080001BC` uses the same header-pointer repoint as fact 2. CFRU's `BPRE.ld` line 401 still has `gBaseStats = 0x8254784`, the vanilla address.

## Gaps

- Radical Red nature storage (mints, overrides): not answerable from CFRU or DPE. Not checked beyond that.
- Ball to item direction: no CFRU table; relies on the ROM's item table, which is not in either repo.
- Vanilla layout comparisons (struct overlays, header pointer block) are inferred; the vanilla decompilations were out of scope.
