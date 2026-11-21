import type { HeldBackDefinition, ProfileDefinition } from "./definition";

/**
 * The GF ROM header starts at 0x08000100. These words point at the species info, item and move
 * tables. The offsets are summed from `struct GFRomHeader` in pokeemerald's `src/rom_header_gf.c`:
 * speciesInfo at 0xBC, items at 0xC8 and moves at 0xCC from the struct start, so 0x1BC, 0x1C8 and
 * 0x1CC in the ROM. pokefirered's `struct GFRomHeader` (`src/rom_header_gf.c`) has the same field order up to
 * `moves`, and `sGFRomHeader` is at 0x08000100 in all four of its builds, so the words are the same.
 */
const GF_SIGNATURE = [
  { address: 0x080001bc, symbol: "gSpeciesInfo" },
  { address: 0x080001c8, symbol: "gItems" },
  { address: 0x080001cc, symbol: "gBattleMoves" },
] as const;

const NO_INTRO_GBA = {
  commit: "5e01cef0d4d264e05f8021d89e6b4a193fd50aa7",
  file: "metadat/no-intro/Nintendo - Game Boy Advance.dat",
} as const;

/**
 * One pokefirered build. The four builds share a repo, so the symbols are pinned to one commit on its
 * `symbols` branch and the SHA-1 files to one commit on `master`, which holds a `.sha1` per build. The
 * addresses move between builds in ROM only, and the table sizes and save layouts are the same.
 */
function pokefirered(build: {
  readonly id: string;
  readonly name: string;
  readonly gameCode: "BPRE" | "BPGE";
  readonly revision: 0 | 1;
  readonly sha1File: string;
  readonly symbolFile: string;
}): ProfileDefinition {
  return {
    id: build.id,
    name: build.name,
    dataFormat: "gen3",
    artVersion: "firered-leafgreen",
    fixture: "none",
    sha1: {
      commit: "ce6406d8c2eaf46d543c8a2606de0c3cb1951982",
      file: build.sha1File,
    },
    noIntro: NO_INTRO_GBA,
    source: {
      repo: "pret/pokefirered",
      commit: "3b401eaf14f193946899eb7c056d5ac02a470126",
      symbolFile: build.symbolFile,
    },
    // pokefirered has no `gTrainerBattleOpponent_B`, because no FireRed or LeafGreen battle has two opposing trainers.
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
      { key: "gTrainerBattleOpponent_A", symbol: "gTrainerBattleOpponent_A" },
      { key: "gMapHeader", symbol: "gMapHeader" },
    ],
    // pokefirered: badge flags are FLAG_BADGE01_GET to FLAG_BADGE08_GET (SYS_FLAGS 0x800 + 0x20 to 0x27). Money is
    // `SaveBlock1.money` at 0x290, the flag array `SaveBlock1.flags` at 0xEE0, and the XOR key
    // `SaveBlock2.encryptionKey` at 0xF20. Money and bag quantities are XORed with it, as in Emerald.
    player: {
      badgeFlags: [0x820, 0x821, 0x822, 0x823, 0x824, 0x825, 0x826, 0x827],
      moneyOffset: 0x290,
      flagsOffset: 0xee0,
      encryptionKeyOffset: 0xf20,
    },
    // pokefirered `struct SaveBlock1`: bagPocket_Items 0x310, KeyItems 0x3B8, PokeBalls 0x430, TMHM 0x464 and
    // Berries 0x54C, with BAG_ITEMS_COUNT 42, BAG_KEYITEMS_COUNT 30, BAG_POKEBALLS_COUNT 13, BAG_TMHM_COUNT 58
    // and BAG_BERRIES_COUNT 43. A slot is `struct ItemSlot` { u16 itemId; u16 quantity }.
    bag: {
      pocketOffsets: [0x310, 0x3b8, 0x430, 0x464, 0x54c],
      pocketCapacities: [42, 30, 13, 58, 43],
    },
    // pokefirered's `gSpeciesInfo` is 412 entries of 0x1C bytes, the same table as Emerald's.
    speciesInfo: { symbol: "gSpeciesInfo", speciesCount: 412 },
    // pokefirered: sizeof(struct Trainer) 40, trainer class names 13 bytes, struct TrainerMoney 2 bytes.
    trainerTables: {
      trainers: { symbol: "gTrainers", entrySize: 40 },
      classNames: { symbol: "gTrainerClassNames", entrySize: 13 },
      money: { symbol: "gTrainerMoneyTable", entrySize: 2 },
    },
    identify: {
      header: { gameCode: build.gameCode, revision: build.revision },
      // `sGFRomHeader` sits at 0x08000100 in all four builds and has the Emerald field order up to `moves`.
      signature: GF_SIGNATURE,
    },
  };
}

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
    noIntro: NO_INTRO_GBA,
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
      { key: "gTrainerBattleOpponent_A", symbol: "gTrainerBattleOpponent_A" },
      { key: "gTrainerBattleOpponent_B", symbol: "gTrainerBattleOpponent_B" },
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
      signature: GF_SIGNATURE,
    },
  },
  pokefirered({
    id: "firered-us-1.0",
    name: "Pokémon FireRed (US 1.0)",
    gameCode: "BPRE",
    revision: 0,
    sha1File: "firered.sha1",
    symbolFile: "pokefirered.sym",
  }),
  pokefirered({
    id: "firered-us-1.1",
    name: "Pokémon FireRed (US 1.1)",
    gameCode: "BPRE",
    revision: 1,
    sha1File: "firered_rev1.sha1",
    symbolFile: "pokefirered_rev1.sym",
  }),
  pokefirered({
    id: "leafgreen-us-1.0",
    name: "Pokémon LeafGreen (US 1.0)",
    gameCode: "BPGE",
    revision: 0,
    sha1File: "leafgreen.sha1",
    symbolFile: "pokeleafgreen.sym",
  }),
  pokefirered({
    id: "leafgreen-us-1.1",
    name: "Pokémon LeafGreen (US 1.1)",
    gameCode: "BPGE",
    revision: 1,
    sha1File: "leafgreen_rev1.sha1",
    symbolFile: "pokeleafgreen_rev1.sym",
  }),
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
    noIntro: NO_INTRO_GBA,
    reason:
      "pret's SHA-1 for the build is not No-Intro's SHA-1 for the retail ROM, so the signature and the table addresses are both suspect",
  },
];
