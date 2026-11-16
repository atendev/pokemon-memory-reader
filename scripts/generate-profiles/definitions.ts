import type { ProfileDefinition } from "./definition";

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
    ],
    // pokeemerald: sizeof(struct Trainer) 40, trainer class names 13 bytes, struct TrainerMoney 2 bytes.
    trainerTables: {
      trainers: { symbol: "gTrainers", entrySize: 40 },
      classNames: { symbol: "gTrainerClassNames", entrySize: 13 },
      money: { symbol: "gTrainerMoneyTable", entrySize: 2 },
    },
    identify: {
      // SHA-1: pret rom.sha1, checked by the generator. CRC32: the No-Intro entry "Pokemon - Emerald
      // Version (USA, Europe)" with the same SHA-1 (amendment 019 §7, assets/019-reference-data-hashes.md).
      sha1: ["f3ae088181bf583e55daf962a92bb46f4f1d07b7"],
      crc32: ["1f1c08fb"],
      header: { gameCode: "BPEE", revision: 0 },
      signature: EMERALD_SIGNATURE,
    },
  },
];
