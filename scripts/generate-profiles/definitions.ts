import type { HeldBackDefinition, ProfileDefinition } from "./definition";

/**
 * The GF ROM header starts at 0x08000100. These words point at the species info, item and move
 * tables. The offsets are summed from `struct GFRomHeader` in pokeemerald's `src/rom_header_gf.c`:
 * speciesInfo at 0xBC, items at 0xC8 and moves at 0xCC from the struct start, so 0x1BC, 0x1C8 and
 * 0x1CC in the ROM.
 */
const EMERALD_SIGNATURE = [
  { address: 0x080001bc, symbol: "gSpeciesInfo" },
  { address: 0x080001c8, symbol: "gItems" },
  { address: 0x080001cc, symbol: "gBattleMoves" },
] as const;

export const definitions: readonly ProfileDefinition[] = [
  {
    id: "emerald-us-1.0",
    name: "Pokémon Emerald (US 1.0)",
    dataFormat: "gen3",
    artVersion: "emerald",
    fixture: "none",
    sha1: {
      commit: "1959b1afccf726b1145d7a07d9c5e678eaea158a",
      file: "rom.sha1",
    },
    noIntro: {
      commit: "5e01cef0d4d264e05f8021d89e6b4a193fd50aa7",
      file: "metadat/no-intro/Nintendo - Game Boy Advance.dat",
    },
    source: {
      repo: "pret/pokeemerald",
      commit: "4a73ce73964859d53a2d21e58db2525e8fa4b31b",
      symbolFile: "pokeemerald.sym",
    },
    addresses: [
      { key: "gPlayerParty", symbol: "gPlayerParty" },
      { key: "gPlayerPartyCount", symbol: "gPlayerPartyCount" },
      { key: "gEnemyParty", symbol: "gEnemyParty" },
      { key: "gEnemyPartyCount", symbol: "gEnemyPartyCount" },
      { key: "gSaveBlock1", symbol: "gSaveBlock1Ptr", pointer: true },
      { key: "gSaveBlock2", symbol: "gSaveBlock2Ptr", pointer: true },
      { key: "gPokemonStorage", symbol: "gPokemonStoragePtr", pointer: true },
      { key: "gBattleTypeFlags", symbol: "gBattleTypeFlags" },
      { key: "gBattleMons", symbol: "gBattleMons" },
      { key: "gBattleStruct", symbol: "gBattleStruct", pointer: true },
      { key: "gBattleResources", symbol: "gBattleResources", pointer: true },
      { key: "gMain", symbol: "gMain" },
      { key: "gBattlerPartyIndexes", symbol: "gBattlerPartyIndexes" },
      { key: "gBattleOutcome", symbol: "gBattleOutcome" },
      { key: "gBattleWeather", symbol: "gBattleWeather" },
      { key: "gSideStatuses", symbol: "gSideStatuses" },
      { key: "gSideTimers", symbol: "gSideTimers" },
      { key: "gMapHeader", symbol: "gMapHeader" },
    ],
    // pokeemerald: badge flags are FLAG_BADGE01_GET to FLAG_BADGE08_GET (SYSTEM_FLAGS 0x860 + 7 to 0xE). Money is
    // `SaveBlock1.money` at 0x490, the flag array `SaveBlock1.flags` at 0x1270, and the XOR key
    // `SaveBlock2.encryptionKey` at 0xAC.
    player: {
      badgeFlags: [0x867, 0x868, 0x869, 0x86a, 0x86b, 0x86c, 0x86d, 0x86e],
      moneyOffset: 0x490,
      flagsOffset: 0x1270,
      encryptionKeyOffset: 0xac,
    },
    // pokeemerald `struct SaveBlock1`: bagPocket_Items 0x560, KeyItems 0x5D8, PokeBalls 0x650, TMHM 0x690 and
    // Berries 0x790, with BAG_ITEMS_COUNT 30, BAG_KEYITEMS_COUNT 30, BAG_POKEBALLS_COUNT 16, BAG_TMHM_COUNT 64
    // and BAG_BERRIES_COUNT 46. A slot is `struct ItemSlot` { u16 itemId; u16 quantity }.
    bag: {
      pocketOffsets: [0x560, 0x5d8, 0x650, 0x690, 0x790],
      pocketCapacities: [30, 30, 16, 64, 46],
    },
    // 412 species is the length of `speciesData` in `gen3-en.json`, which a test pins.
    speciesInfo: { symbol: "gSpeciesInfo", speciesCount: 412 },
    // pokeemerald: sizeof(struct Trainer) 40, trainer class names 13 bytes, struct TrainerMoney 2 bytes.
    trainerTables: {
      trainers: { symbol: "gTrainers", entrySize: 40 },
      classNames: { symbol: "gTrainerClassNames", entrySize: 13 },
      money: { symbol: "gTrainerMoneyTable", entrySize: 2 },
    },
    identify: {
      header: { gameCode: "BPEE", revision: 0 },
      signature: EMERALD_SIGNATURE,
    },
  },
];

/** Revisions the generator skips. The release gate also checks that none of them is a built-in profile. */
export const heldBack: readonly HeldBackDefinition[] = [
  {
    id: "sapphire-de-1.0",
    name: "Pokémon Saphir-Edition (DE 1.0)",
    repo: "pret/pokeruby",
    sha1: {
      commit: "5784633ce4ef7ade1a7f2d2d0c288e3d5e6cdd7f",
      file: "sapphire_de.sha1",
    },
    noIntro: {
      commit: "5e01cef0d4d264e05f8021d89e6b4a193fd50aa7",
      file: "metadat/no-intro/Nintendo - Game Boy Advance.dat",
    },
    reason:
      "pret's SHA-1 for the build is not No-Intro's SHA-1 for the retail ROM, so the signature and the table addresses are both suspect",
  },
];
