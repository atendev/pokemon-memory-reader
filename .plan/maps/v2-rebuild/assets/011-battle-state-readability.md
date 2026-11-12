# Battle state readability

Research for ticket 011. Checked 2026-11-11 against raw files on the pret and CFRU `master` branches and the pret `symbols` branches. Items marked unverified were not confirmed from a primary source. Symbol addresses were read from the `.sym` files named in [asset 002](./002-decomp-symbol-data.md).

## Short answer

- Every generation exposes both active mons live (species, HP, status, moves, PP, stats, stat stages) and a wild-vs-trainer flag. Only Gen 2 and Gen 3 expose held items.
- The opponent's full party is readable from the first turn in a trainer battle, because the game builds it before the intro (Gen 1 `ReadTrainer`, Gen 2 `ReadTrainerParty`, Gen 3 `CreateNPCTrainerParty`). It is not limited to mons already sent out, so the viewer must decide whether to reveal unseen mons.
- Trainer name, class, prize money and usable items are mostly not in RAM as ready values. The adapter reads a trainer ID from RAM and looks the rest up in ROM tables (`gTrainers`, `gTrainerClassNames`, `gTrainerMoneyTable`), or computes it.
- "In battle" has a clean flag in every generation. Gen 3 needs two reads to tell "ended" from "never started", because most battle globals are not cleared at battle end.
- Many Gen 1 and Gen 2 battle buffers share a union with other data (wild encounter tables, link RNG), so they hold garbage outside battle. Gate every read on the in-battle flag.

## Per-generation table

Neutral stat stage is 7 in Gen 1 and Gen 2 (stages 1 to 13, from `BASE_STAT_LEVEL`) and 6 in Gen 3 (`DEFAULT_STAT_STAGE`, 0 to 12). These two constants were not re-opened in this pass (unverified).

| Need | Gen 1 (pokered, pokeyellow) | Gen 2 (pokegold, pokecrystal) | Gen 3 (pokeruby, pokeemerald, pokefirered) and CFRU |
| --- | --- | --- | --- |
| In battle? | `wIsInBattle`: 0 none, 1 wild, 2 trainer, -1 lost ([wram.asm](https://github.com/pret/pokered/blob/master/ram/wram.asm)) | `wBattleMode`: 0 overworld, 1 wild, 2 trainer ([wram.asm](https://github.com/pret/pokecrystal/blob/master/ram/wram.asm)) | `gMain.inBattle` (1-bit field) set at battle start, cleared at battle end ([main.h](https://github.com/pret/pokeemerald/blob/master/include/main.h), [battle_main.c](https://github.com/pret/pokeemerald/blob/master/src/battle_main.c)) |
| Wild vs trainer | `wIsInBattle` 1 vs 2; `wCurOpponent` is the species (wild) or trainer class + `OPP_ID_OFFSET` (trainer) | `wBattleMode` 1 vs 2; `wOtherTrainerClass` is 0 for wild | `gBattleTypeFlags & BATTLE_TYPE_TRAINER` (bit 3). Ruby also has `BATTLE_TYPE_WILD` (bit 2). Bit 2 is `IS_MASTER` in Emerald and FRLG, so do not test it there. |
| Double battle | not in the game | not in the game | `BATTLE_TYPE_DOUBLE` (bit 0), `BATTLE_TYPE_MULTI` (bit 6), `BATTLE_TYPE_TWO_OPPONENTS` (Emerald bit 15) |
| Safari, tutorial, roamer, etc. | `wBattleType`: 0 normal, 1 old man, 2 safari | `wBattleType` (`BATTLETYPE_*`) | other `BATTLE_TYPE_*` bits: `SAFARI`, `ROAMER`, `LEGENDARY`, `LINK`, `BATTLE_TOWER`... |
| Battle ended / result | `wBattleResult` (0 win, 1 lose, 2 draw); `wIsInBattle` back to 0 | `wBattleResult` (WIN, LOSE, DRAW; bit 6 caught Celebi, bit 7 box full) | `gBattleOutcome` (`B_OUTCOME_WON` 1, `LOST` 2, `DREW` 3, `RAN` 4, `CAUGHT` 7, `FORFEITED` 9, ...) |
| Active player mon | `wBattleMon` (battle struct: species, HP, box level, status, types, moves, DVs, level, stats, PP) | `wBattleMon` (species, item, moves, DVs, PP, happiness, level, status, HP, stats, types); party slot `wCurBattleMon` | `gBattleMons[0]` (and `[2]` in doubles), 0x58 bytes each |
| Active opponent mon | `wEnemyMon` | `wEnemyMon` (same struct, includes `Item`); party slot `wCurOTMon` | `gBattleMons[1]` (and `[3]` in doubles); party slot from `gBattlerPartyIndexes[n]` |
| Opponent full party | `wEnemyPartyCount`, `wEnemyPartySpecies`, `wEnemyMon1`..`wEnemyMon6` (party structs, nicknames in `wEnemyMonNicks`) | `wOTPartyCount`, `wOTPartySpecies`, `wOTPartyMon1`..`6` (party structs, OT names, nicknames) | `gEnemyPartyCount`, `gEnemyParty` (6 x 0x64 `struct Pokemon`, same decoder as `gPlayerParty`) |
| Held item (opponent) | none in the game | party struct `Item`, battle struct `Item` | `struct Pokemon` held item; `gBattleMons[n].item` |
| Moves and PP | party struct moves and PP, `wEnemyMon` moves and PP | same, plus `wEnemyMon` PP | `gBattleMons[n].moves`/`pp` (live), `struct Pokemon` moves and PP (party) |
| Stat stages | `wPlayerMonStatMods`, `wEnemyMonStatMods` (6 bytes: atk, def, spd, spc, acc, eva) | `wPlayerStatLevels`, `wEnemyStatLevels` (7 bytes: atk, def, spd, spA, spD, acc, eva) | `gBattleMons[n].statStages[8]` (hp slot, atk, def, spd, spA, spD, acc, eva) |
| Weather | none | `wBattleWeather` (0 none, 1 rain, 2 sun, 3 sandstorm; 4 to 6 are the ending states), `wWeatherCount` | `gBattleWeather` bitmask (`B_WEATHER_RAIN`, `SANDSTORM`, `SUN`, `HAIL`, each temporary or permanent) |
| Field and side effects | screens as bits in `wPlayerBattleStatus3`/`wEnemyBattleStatus3` and status1/2 bits | `wPlayerScreens`, `wEnemyScreens` (spikes, safeguard, light screen, reflect) with `*SafeguardCount` etc. | `gSideStatuses[2]` (`SIDE_STATUS_REFLECT`, `LIGHTSCREEN`, `SPIKES`, `SAFEGUARD`, `MIST`), `gSideTimers[2]`, `gWishFutureKnock`, `gStatuses3`, `gDisableStructs` |
| Volatile status | `wPlayerBattleStatus1..3`, `wEnemyBattleStatus1..3` | `wPlayerSubStatus1..5`, `wEnemySubStatus1..5` | `gBattleMons[n].status2`, `gStatuses3`, `gDisableStructs[n]` |
| Trainer class | `wTrainerClass`, or `wCurOpponent - OPP_ID_OFFSET` | `wOtherTrainerClass` (also `wTrainerClass`) | `gTrainers[gTrainerBattleOpponent_A].trainerClass`, name from `gTrainerClassNames` |
| Trainer ID | `wTrainerNo` (instance within class) | `wOtherTrainerID` | `gTrainerBattleOpponent_A` (u16 trainer index); `_B` for a second opponent. Ruby has one `gTrainerBattleOpponent`. FRLG sym has only `_A`. |
| Trainer name | `wTrainerName` (13 bytes) | derived from class and ID via ROM tables; `wOTClassName` holds the class name | `gTrainers[id].trainerName` (ROM) |
| Prize money | `wAmountMoneyWon` (3 bytes BCD, set on win), `wTrainerBaseMoney` (BCD) | `wEnemyTrainerBaseReward`, `wBattleReward` (3 bytes), `wPayDayMoney` | computed: `4 * lastMonLevel * moneyMultiplier * gTrainerMoneyTable[class].value` (x2 doubles, A+B for two opponents), plus `gPaydayMoney` |
| Trainer usable items | AI item counts in `wAICount` and ROM AI tables (not read in detail) | `wEnemyTrainerItem1`, `wEnemyTrainerItem2` | `gTrainers[id].items[4]` (ROM; in-battle remaining use tracked in `gBattleResources`->AI data, heap) |
| Valid when | see "Validity" | see "Validity" | see "Validity" |

## Gen 1 (pokered, pokeyellow)

Source: [pokered ram/wram.asm](https://github.com/pret/pokered/blob/master/ram/wram.asm), [macros/ram.asm](https://github.com/pret/pokered/blob/master/macros/ram.asm), pokeyellow equivalents. Pokeyellow defines the same labels (checked by grep for the key names).

- Active mons: `wBattleMon` and `wEnemyMon` are `battle_struct`: species, HP (2 bytes), party position or box level, status, type 1 and 2, catch rate, 4 moves, DVs (2 bytes), level, max HP, attack, defense, speed, special, 4 PP bytes. Nicknames are `wBattleMonNick` and `wEnemyMonNick`. Stats in the struct are the battle copies; the unmodified values are in `wPlayerMonUnmodified*` and `wEnemyMonUnmodified*`.
- Stat stages: `wPlayerMonStatMods` and `wEnemyMonStatMods`, with named bytes `wEnemyMonAttackMod` ... `wEnemyMonEvasionMod`.
- Opponent party: `wEnemyPartyCount`, `wEnemyPartySpecies`, then six `party_struct` entries `wEnemyMon1`..`wEnemyMon6` (box struct plus level and stats). Gen 1 has no held items.
- Union warning: `wEnemyPartyCount` through `wEnemyMon6` sit inside a `UNION` whose other arm is `wGrassRate`, `wGrassMons`, `wWaterRate`, `wWaterMons` (the map's wild encounter tables). So outside a trainer battle this region holds wild tables, not a party. After a trainer battle it is overwritten when the next map loads.
- Trainer: `wTrainerClass`, `wTrainerNo`, `wTrainerName` (13 bytes, `$50` terminated), `wCurOpponent` (class + `OPP_ID_OFFSET` for trainers). Money won is `wAmountMoneyWon`. Gen 1 prize money is last mon level times the class base money (`wTrainerBaseMoney`); this formula is from game knowledge, not re-read from source.
- Usable items: the trainer AI uses per-class item counts in ROM and `wAICount`; nothing richer is in WRAM. Treat as not readable beyond the count.
- Move PP: the PP byte also carries the PP Up bits (top two bits) in party structs; the `battle_struct` PP bytes are the same (unverified for the battle copy).

## Gen 2 (pokegold, pokecrystal)

Source: [pokecrystal ram/wram.asm](https://github.com/pret/pokecrystal/blob/master/ram/wram.asm), [macros/ram.asm](https://github.com/pret/pokecrystal/blob/master/macros/ram.asm), [engine/battle/read_trainer_party.asm](https://github.com/pret/pokecrystal/blob/master/engine/battle/read_trainer_party.asm). Pokegold defines the same labels (`wBattleMode`, `wOTClassName`, `wEnemyTrainerItem1` found by grep).

- `battle_struct` (`wBattleMon`, `wEnemyMon`): species, item, 4 moves, DVs, 4 PP, happiness, level, status (2 bytes), HP, max HP, attack, defense, speed, spAtk, spDef, type 1 and 2. `wEnemyMon` is followed by `wEnemyMonBaseStats`, `wEnemyMonCatchRate`, `wEnemyMonBaseExp`.
- Union warning: `wEnemyMon` shares a `UNION` with `wOTLinkBattleRNData` (link battle random numbers). It is garbage outside battle.
- Opponent party: `wOTPartyCount`, `wOTPartySpecies`, `wOTPartyMon1`..`6` in a union with the catch-tutorial dude pack (`wDudeNumItems`, ...) further down. `ReadTrainerParty` zero-fills the party then writes the trainer's mons; trainer mons can carry items and custom moves (trainer types in ROM). Wild battles do not reset it, so a stale party from the last trainer fight remains; gate on `wBattleMode == 2`.
- `ReadTrainerParty` returns early in link and Battle Tower battles, which fill `wOTPartyMons` from the link data or the Tower instead (code seen at the top of the routine).
- Active enemy party slot: `wCurOTMon`. Party flags: `wBattleParticipantsNotFainted`.
- Trainer: `wOtherTrainerClass` (0 for wild), `wOtherTrainerID`, `wTrainerClass`, `wOTClassName` (class name string), `wEnemyTrainerItem1/2`, `wEnemyTrainerBaseReward`, `wEnemyTrainerAIFlags` (3 bytes), `wBattleReward` (3 bytes), `wPayDayMoney` (3 bytes). The trainer's personal name is not confirmed to persist in a WRAM buffer; `GetTrainerName` writes to `wStringBuffer1`, which is reused constantly. Look it up from class and ID in ROM (unverified).
- Weather: `wBattleWeather`, `wWeatherCount`. Screens and spikes: `wPlayerScreens`, `wEnemyScreens` plus per-effect counters.
- Stat levels: `wPlayerStatLevels`, `wEnemyStatLevels`, 7 bytes each (atk, def, spd, spAtk, spDef, acc, eva) followed by one pad byte.
- `wBattleType` has `BATTLETYPE_*` values (normal, can't-lose tutorial, contest, etc.).

## Gen 3 (pokeruby, pokeemerald, pokefirered)

Source: [pokeemerald include/battle.h](https://github.com/pret/pokeemerald/blob/master/include/battle.h), [include/constants/battle.h](https://github.com/pret/pokeemerald/blob/master/include/constants/battle.h), [include/pokemon.h](https://github.com/pret/pokeemerald/blob/master/include/pokemon.h), [include/data.h](https://github.com/pret/pokeemerald/blob/master/include/data.h), [src/battle_main.c](https://github.com/pret/pokeemerald/blob/master/src/battle_main.c), [src/battle_script_commands.c](https://github.com/pret/pokeemerald/blob/master/src/battle_script_commands.c), [src/battle_setup.c](https://github.com/pret/pokeemerald/blob/master/src/battle_setup.c); [pokefirered constants/battle.h](https://github.com/pret/pokefirered/blob/master/include/constants/battle.h); [pokeruby constants/battle.h](https://github.com/pret/pokeruby/blob/master/include/constants/battle.h) and `pokeruby` `include/pokemon.h`; symbols from the `symbols` branches ([emerald](https://github.com/pret/pokeemerald/blob/symbols/pokeemerald.sym), [firered](https://github.com/pret/pokefirered/blob/symbols/pokefirered.sym), [ruby](https://github.com/pret/pokeruby/blob/symbols/pokeruby.sym)).

### Symbols verified in the `.sym` files

| Symbol | Emerald | FireRed | Ruby | Notes |
| --- | --- | --- | --- | --- |
| `gMain` | 03 0022c0 (0x43c) | 03 0030f0 (0x43c) | 03 001770 (0x440) | `inBattle` at +0x439 (E, FR) or +0x43d (Ruby), bit 1; bit order is the compiler's, check against a savestate |
| `gBattleTypeFlags` | 02022fec (u32) | 02022b4c (u32) | 020239f8 (u16) | |
| `gBattleMons` | 02024084 (0x160) | 02023be4 (0x160) | 02024a80 | 4 x 0x58 |
| `gBattlersCount` | 0202406c | 02023bcc | 02024a68 | 2 in singles, 4 in doubles |
| `gBattlerPartyIndexes` | 0202406e | 02023bce | 02024a6a | 4 x u16 party slot per battler |
| `gBattlerPositions` | 02024076 | 02023bd6 | 02024a72 | |
| `gAbsentBattlerFlags` | 02024210 | 02023d70 | 02024c0c | |
| `gSideStatuses` / `gSideTimers` | 0202428e / 02024294 | 02023dde / 02023de4 | 02024c7a / 02024c80 | |
| `gPaydayMoney` | 0202432e | 02023e7e | 02024d1a | |
| `gBattleOutcome` | 0202433a | 02023e8a | 02024d26 | |
| `gBattleWeather` | 020243cc | 02023f1c | 02024db8 | |
| `gPlayerPartyCount` / `gEnemyPartyCount` | 020244e9 / 020244ea | 02024029 / 0202402a | 03004350 / 030045b8 (u32) | |
| `gEnemyParty` | 02024744 (0x258) | 0202402c (0x258) | 030045c0 (0x258) | Ruby's is in IWRAM |
| `gTrainerBattleOpponent_A` / `_B` | 02038bca / 02038bcc | 020386ae / absent | `gTrainerBattleOpponent` 0202ff5e | |
| `gTrainers` | 08310030 | 0823eac8 | 081f04fc | ROM table |
| `gTrainerClassNames` | 0830fcd4 | 0823e558 | 081f0208 | ROM |
| `gTrainerMoneyTable` | 0831aeb8 | 0824f220 | not in sym | ROM; Ruby location unverified |
| `gBattleStruct`, `gBattleResources` | 0202449c, 020244a8 | 02023fe8, 02023ff4 | not checked | heap pointers: read through them |

Ruby battle symbols have size 0 in the `.sym`, so use the layout sizes below, not the file.

### `struct BattlePokemon` (0x58 bytes, same layout in Ruby, Emerald, FireRed)

Offsets from `include/pokemon.h`: `species` 0x00, `attack` 0x02, `defense` 0x04, `speed` 0x06, `spAttack` 0x08, `spDefense` 0x0A, `moves[4]` 0x0C, packed IVs and `isEgg` and ability slot 0x14 to 0x17, `statStages[8]` 0x18, `ability` 0x20, `types[2]` 0x21, `pp[4]` 0x24, `hp` 0x28, `level` 0x2A, `friendship` 0x2B, `maxHP` 0x2C, `item` 0x2E, `nickname` 0x30, `ppBonuses` 0x3B, `otName` 0x3C, `experience` 0x44, `personality` 0x48, `status1` 0x4C, `status2` 0x50, `otId` 0x54. Ruby names `types` as `type1`/`type2` at 0x21/0x22, the same bytes.

### Battle flags

- `gBattleTypeFlags` is `u32` in Emerald and FireRed, `u16` in Ruby. Bits 0 to 14 are shared across the three (`DOUBLE`, `LINK`, bit 2, `TRAINER`, `FIRST_BATTLE`, bit 5, `MULTI`, `SAFARI`, `BATTLE_TOWER`, tutorial, `ROAMER`, `EREADER_TRAINER`, `KYOGRE_GROUDON`, `LEGENDARY`, `REGI`). Bit 2 is `WILD` in Ruby and `IS_MASTER` in Emerald and FireRed. Higher bits differ: Emerald bit 15 is `TWO_OPPONENTS`, FireRed bit 15 is `GHOST`; Emerald has the Battle Frontier modes (Dome, Palace, Arena, Factory, Pike, Pyramid), recorded, trainer hill, secret base, legendary Groudon/Kyogre/Rayquaza bits.
- Wild vs trainer: `flags & BATTLE_TYPE_TRAINER` (bit 3), valid in all three.
- Double: `BATTLE_TYPE_DOUBLE` (bit 0). Two trainers at once: Emerald `BATTLE_TYPE_TWO_OPPONENTS`; both trainer IDs are in `gTrainerBattleOpponent_A` and `_B`. In-game partner (Emerald `BATTLE_TYPE_INGAME_PARTNER`) and `MULTI` battles add an ally.
- Enemy party in two-opponent battles: opponent A fills `gEnemyParty[0..2]` and opponent B `gEnemyParty[3..5]` (each capped at `PARTY_SIZE / 2`), per `CreateNPCTrainerParty`.
- Battler slots: battler 0 is the player, 1 the opponent, 2 the player's partner or second mon, 3 the second opponent mon. `gBattlerPositions` maps battlers to sides (bit 0 = side).

### Trainer data (ROM, Emerald layout)

`struct Trainer` in `include/data.h`: `partyFlags` 0x00, `trainerClass` 0x01, `encounterMusic_gender` 0x02, `trainerPic` 0x03, `trainerName[12]` 0x04, `items[4]` (u16) 0x10, `doubleBattle` 0x18, `aiFlags` 0x1C, `partySize` 0x20, `party` pointer 0x24. Total 0x28 bytes. FireRed and CFRU's struct use the same fields (checked in CFRU `include/battle.h`). Name decoding needs the Gen 3 character map.

### Prize money

`GetTrainerMoneyToGive` in `battle_script_commands.c`: last party mon level times 4 times `gBattleStruct->moneyMultiplier` times the class `value` from `gTrainerMoneyTable`; doubled in `DOUBLE`; for `TWO_OPPONENTS` the second trainer's amount is added. `gPaydayMoney` adds Pay Day coins. The adapter can compute the expected prize before the battle ends from the opponent party and class, but `moneyMultiplier` lives in `gBattleStruct` (heap).

### Validity

- `gMain.inBattle`: set in `CB2_InitBattleInternal`, cleared in `FreeRestoreBattleData` and the end-of-battle path. Best "in battle" flag.
- `gEnemyParty`: filled in `CB2_InitBattleInternal` (trainer: `CreateNPCTrainerParty`; wild: the encounter code). Zeroed (`ZeroEnemyPartyMons`) in `FreeRestoreBattleData`. So species 0 in all slots means no battle, not a partly seen party.
- `gBattleTypeFlags`: written when a battle is set up (wild setup assigns `= 0` then ORs flags); never cleared on exit, so it keeps the last battle's flags. Only trust it while `inBattle` is 1.
- `gBattleMons`, `gSideStatuses`, `gBattleWeather`, `gPaydayMoney`: cleared at battle start in `BattleStartClearSetData`. After battle end they hold the final battle's values until the next battle.
- `gBattleOutcome`: reset to 0 in `BattleStartClearSetData`, set when the battle ends, copied to `gSpecialVar_Result`. So `inBattle == 0 && gBattleOutcome != 0` means "last battle just ended with this result", but it remains non-zero in the overworld until the next battle starts. The adapter should detect the 1 to 0 transition of `inBattle`, then read `gBattleOutcome` once.
- Switching mons mid-battle: `gBattlerPartyIndexes` updates. `gBattleMons` can carry a Transform or Illusion-less copy of the opponent (Transform sets `status2`/species), so the party mon, not `gBattleMons`, is the source of truth for the real species and moves.
- Pointers: `gBattleStruct` and `gBattleResources` are heap pointers valid only during battle (freed in `FreeRestoreBattleData`); dereferencing outside battle reads freed memory.

## CFRU hacks

Source: [CFRU `BPRE.ld`](https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/master/BPRE.ld), [`include/new/ram_locs_battle.h`](https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/master/include/new/ram_locs_battle.h), [`ram_locs.h`](https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/master/include/new/ram_locs.h), [`include/constants/battle.h`](https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/master/include/constants/battle.h), [`include/battle.h`](https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/master/include/battle.h).

- The core globals keep their vanilla FireRed 1.0 addresses: `gBattleTypeFlags = 0x2022B4C`, `gBattleMons = 0x2023BE4`, `gBattlersCount = 0x2023BCC`, `gBattlerPartyIndexes = 0x2023BCE`, `gBattlerPositions = 0x2023BD6`, `gSideStatuses = 0x2023DDE`, `gPaydayMoney = 0x2023E7E`, `gBattleOutcome = 0x2023E8A`, `gBattleWeather = 0x2023F1C`, `gEnemyParty = 0x202402C`, `gEnemyPartyCount = 0x202402A`, `gTrainerBattleOpponent_A = 0x20386AE`, `gBattleStruct = 0x2023FE8`, `gBattleResources = 0x2023FF4`, `gMain = 0x30030F0`. These match the FireRed `.sym` values above, so a CFRU hack reuses the FireRed battle profile.
- `struct BattlePokemon` is still 0x58 bytes and `gBattleMons[MAX_BATTLERS_COUNT]` is declared in `include/battle.h`; the field list was not diffed against vanilla (unverified), but the addresses above and the 4-battler array agree.
- `BATTLE_TYPE_*` in CFRU follows the FireRed bits 0 to 14 except bit 4 (`OAK_TUTORIAL`), bit 5 (`LINK_ESTABLISHED`), bit 9 (`OLD_MAN`) and bit 15 (`GHOST`). It adds `TWO_OPPONENTS` at `0x200000`, `INGAME_PARTNER` at `0x400000`, `RING_CHALLENGE`, `MOCK_BATTLE`, `BATTLE_SANDS`, `BATTLE_CIRCUS`, `BENJAMIN_BUTTERFREE`, `CAMOMONS`, `MEGA_BRAWL`, `DYNAMAX` (`0x40000000`) and `SHADOW_WARRIOR` (`0x80000000`). A CFRU decoder cannot reuse Emerald's flag table.
- Added field state: `gTerrainType` at `0x203E028` (terrain), a `gNewBS` pointer near `0x203E038` (extra battle struct with Trick Room, Gravity, Magic Room, Wonder Room and Dynamax state; its layout is in CFRU source and was not read here). `ram_locs_battle.h` says do not go past `0x203E048`.
- `gTrainerBattleOpponent_B` is not defined in `ram_locs_battle.h` (only `sTrainerBattleMode` at `0x20386AC` and `gTrainerBattleOpponent_A` at `0x20386AE`; `0x20386B0` is `sTrainerEventObjectLocalId`). Whether CFRU stores a second opponent ID, and where, is unverified.
- Trainer data: CFRU's `gTrainers` is repointed (the line is commented out in `BPRE.ld` at `0x823EAC8`), so the table address comes from a hack's own build output. The `struct Trainer` header is unchanged; CFRU adds party flags (`PARTY_FLAG_CUSTOM_MOVES`, `PARTY_FLAG_HAS_ITEM`) and its own spread data. Names and class tables must be located per hack.
- Hack-specific changes (extra party slots, larger species ID range, expanded move or item IDs) are per hack, as asset 002 already concluded. Treat CFRU battle fields as valid only after a savestate check.

## Gaps and unverified items

- Gen 1 and Gen 2 stat-stage neutral values, Gen 1 prize formula, Gen 1 AI item layout: not re-read in source in this pass.
- Gen 2 trainer personal name has no confirmed stable WRAM buffer.
- Ruby `gTrainerMoneyTable` address and ruby/emerald `gMain.inBattle` bit order are assumptions to confirm with a savestate.
- CFRU `struct BattlePokemon` field diff, `gNewBS` layout, `gTrainerBattleOpponent_B`, and any decomp hack that changes the above (for example pokeemerald-expansion widens `gBattleMons` and `gBattleTypeFlags`; not read here).
- Gen 3 link, recorded, and Battle Frontier battles fill the enemy party from link or Frontier data, not `gTrainers`.
