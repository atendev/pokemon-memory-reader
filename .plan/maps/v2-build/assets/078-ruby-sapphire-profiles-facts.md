# 078 Ruby and Sapphire profile facts

Sources: pret/pokeruby `symbols` 78b19905a760095bc45eab2e36906c6e8c208dce (`.sym`), `master` 5784633ce4ef7ade1a7f2d2d0c288e3d5e6cdd7f (headers, SHA-1 files). Gathered by grep and fetch only, no ROM bytes.

## Builds

Six English builds: `pokeruby`, `pokeruby_rev1`, `pokeruby_rev2`, `pokesapphire`, `pokesapphire_rev1`, `pokesapphire_rev2`. `.sym` files are `<name>.sym`, SHA-1 files at `master` are `ruby.sha1`, `ruby_rev1.sha1`, `ruby_rev2.sha1`, `sapphire.sha1`, `sapphire_rev1.sha1`, `sapphire_rev2.sha1` (one line each, `<sha1>  pokeruby.gba` form). Ids to use: `ruby-us-1.0`, `ruby-us-1.1`, `ruby-us-1.2`, `sapphire-us-1.0`, `sapphire-us-1.1`, `sapphire-us-1.2`. `artVersion` is `ruby-sapphire`. German builds stay out (English only), and `sapphire-de-1.0` stays in `heldBack`. Game codes: Ruby `AXVE`, Sapphire `AXPE`, revision 0, 1, 2 (software version byte at 0xBC).

## Symbols (all globals except where noted)

- Static: `gPlayerParty`, `gPlayerPartyCount` (size 4), `gEnemyParty`, `gEnemyPartyCount`, `gMain`, `gMapHeader`, `gSaveBlock1`, `gSaveBlock2`, `gPokemonStorage` (0x83D0), `gBattleTypeFlags`, `gBattleMons`, `gBattlerPartyIndexes`, `gBattleOutcome`, `gBattleWeather`, `gSideStatuses`, `gSideTimers` (those last eight have size 0, they are labels).
- Renamed: the opposing trainer is `gTrainerBattleOpponent` (singular, u16). There is no `_B`, so Ruby has no two-opponent battle.
- `gBattleStruct` is `#define gBattleStruct ((struct BattleStruct *)(gSharedMem + 0x0))` in `include/ewram.h`, so use `gSharedMem` (0x02000000, a non-pointer static entry). `moneyMultiplier` is at `0x16056`.
- No `gBattleResources`, `gSaveBlock1Ptr`, `gSaveBlock2Ptr`, `gPokemonStoragePtr`, `gSpeciesInfo` (`gBaseStats`, size 0x2D10, is the species table, 412 x 0x1C) or `gTrainerMoneyTable`.
- Money table is `gTrainerMoney` (global, size 0). `data/trainer_money.inc` has 55 entries of 4 bytes (`class, value, 0, 0`), the last one the 0xFF terminator, so count 55 (220 bytes, ends at the next symbol). Entry size 4 not 2.
- `gTrainers` 0x6C70 / 40 = 694, `gTrainerClassNames` 0x2F2 / 13 = 58.

## Layouts that differ from Emerald

- `gMain.inBattle`: byte `0x43D`, mask `0x02` (Emerald and FireRed `0x439`). `gMain` size 0x440.
- `struct SideTimer`: 12 bytes, `spikesAmount` at `+6` (Emerald `+10`).
- `gBattleStruct->moneyMultiplier` at `0x16056` from `gSharedMem` (Emerald `0x4A`).
- SaveBlock1: money `0x490` (not XORed), flags `0x1220`, bag items `0x560`, key items `0x5B0`, balls `0x600`, TM/HM `0x640`, berries `0x740`. Capacities 20, 20, 16, 64, 46. SaveBlock2 has no `encryptionKey`.
- Badge flags: `SYSTEM_FLAGS` 0x800 + 7 to 0xE, so `[0x807 .. 0x80E]`.
- Same as Emerald: `BattlePokemon` layout (0x58), `MapHeader.regionMapSectionId` at 0x14, SaveBlock2 name, trainer ID and play time offsets, SaveBlock1 pos and location, party and box mon layouts, `PokemonStorage` size, battle type bits 0, 3, 6 and tableless bits 1, 8, 11, `B_OUTCOME_*`, `SIDE_STATUS_*` (spikes 0x10, safeguard 0x20, mist 0x100), `B_WEATHER_*`.
- Signature words (036 amendment): `{ at: atk93_tryKO + 0x16C (size 0x2E0, local), value: gBattleMoves }` and `{ at: sPokemonMenuActions + 0x50 (size 0xC0, local), value: gMoveNames + 0xC3 }`. Example for Ruby 1.0: at `0x08026CE4` bytes `2cb11f08`, at `0x0839F4E4` bytes `e3831f08`.

## Plan decided by the implementer

1. Per-game battle layout goes in the profile `constants` block (spec §5, "per-game constants, hand-written"): `inBattleOffset`, `sideTimerSpikesOffset`, `moneyMultiplierOffset`, `trainerMoneyEntrySize`. The Gen 3 full schema types them as an optional strict object, the decoder defaults to the Emerald values, and Emerald and FireRed JSON stays unchanged.
2. `gBattleResources` becomes optional in `gen3Addresses` (nothing reads it).
3. `ProfileDefinition` gains: `constants`, `addresses[].symbol` already maps keys, a `count` override for a size-0 table, and signature words `{ at, value }` (spec 036 item 4) with the anchor size check. The sym parser keeps local symbols by exact name for anchors only.
