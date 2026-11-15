import type { ProfileDefinition } from "./definition";

/**
 * The GF ROM header starts at 0x08000100. These words point at the species info, item and move
 * tables (gSpeciesInfo at 0x1BC, gItems at 0x1C8, gBattleMoves at 0x1CC in pokeemerald's header).
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
      // pret rom.sha1 and the No-Intro entry with the same SHA-1 (amendment 019 §7, hash research).
      sha1: ["f3ae088181bf583e55daf962a92bb46f4f1d07b7"],
      crc32: ["1f1c08fb"],
      header: { gameCode: "BPEE", revision: 0 },
      signature: EMERALD_SIGNATURE,
    },
  },
];
