import { z } from "zod";
import { anyAddress, staticAddress } from "../../profile/address";

const gba = staticAddress("gba");
const gbaAny = anyAddress("gba");

/** The Gen 3 address keys a decoder may read. A save block or battle pointer is a pointer entry on Emerald and FireRed, and static on Ruby and Sapphire (spec §5.1). */
export const gen3Addresses = z
  .object({
    gPlayerParty: gba,
    gPlayerPartyCount: gba,
    gEnemyParty: gba,
    gEnemyPartyCount: gba,
    gSaveBlock1: gbaAny,
    gSaveBlock2: gbaAny,
    gPokemonStorage: gbaAny,
    gBattleTypeFlags: gba,
    gBattleMons: gba,
    gBattleStruct: gbaAny,
    /** Absent on Ruby and Sapphire. No decoder reads it. */
    gBattleResources: gbaAny.optional(),
    gMain: gba,
    gBattlerPartyIndexes: gba,
    gBattleOutcome: gba,
    gBattleWeather: gba,
    gSideStatuses: gba,
    gSideTimers: gba,
    gTrainerBattleOpponent_A: gba,
    /** Absent on FireRed and LeafGreen, whose battles never have two opposing trainers. */
    gTrainerBattleOpponent_B: gba.optional(),
    gMapHeader: gba,
  })
  .strict();

/**
 * The per-game values the `player` decoder reads (amendment 017 §6). The offsets are into the
 * save blocks and differ between games, so they are profile values rather than decoder constants.
 * `encryptionKeyOffset` is absent for Ruby and Sapphire, which keep money in the clear. A file
 * sets it to null to drop an inherited key.
 */
export const gen3Player = z
  .object({
    /** The event flag ID of each badge, in game order. Flag `n` is bit `n % 8` of byte `n >> 3` of the flag array. */
    badgeFlags: z.array(z.int().min(0)).length(8),
    /** Offset of the 32-bit money value in save block 1. */
    moneyOffset: z.int().min(0),
    /** Offset of the event flag array in save block 1. */
    flagsOffset: z.int().min(0),
    /** Offset of the 32-bit encryption key in save block 2. */
    encryptionKeyOffset: z.int().min(0).optional(),
  })
  .strict();

/**
 * The per-game values the `bag` decoder reads (amendment 017 §6). Both arrays hold the five pockets
 * in game order: items, keyItems, balls, tmhm, berries. A hack that changes one pocket restates its
 * whole array, since profile blocks merge one level deep (amendment 018). Quantities are XORed
 * with the low 16 bits of the key at `player.encryptionKeyOffset` where the game has one.
 */
export const gen3Bag = z
  .object({
    /** Offset of each pocket's first slot in save block 1. A slot is a u16 item ID then a u16 quantity. */
    pocketOffsets: z.array(z.int().min(0)).length(5),
    /** The slot count of each pocket. */
    pocketCapacities: z.array(z.int().min(1)).length(5),
  })
  .strict();

/**
 * The per-game layout values the battle decoders read (spec §5, "per-game constants, hand-written"). Each
 * is absent in Emerald and FireRed, which use the defaults below. Ruby and Sapphire differ in all four.
 */
export const gen3Constants = z
  .object({
    /** Offset of the byte in `gMain` whose bit 1 is `inBattle`. */
    inBattleOffset: z.int().min(0).optional(),
    /** Offset of `spikesAmount` in the 12-byte `struct SideTimer`. */
    sideTimerSpikesOffset: z.int().min(0).max(11).optional(),
    /** Offset of `moneyMultiplier` in `gBattleStruct`. */
    moneyMultiplierOffset: z.int().min(0).optional(),
    /** Byte size of one `gTrainerMoneyTable` entry (a class ID, a value and any padding). */
    trainerMoneyEntrySize: z.int().min(2).max(16).optional(),
  })
  .strict()
  .default({});

/** The Emerald and FireRed values for every key of `gen3Constants`. */
export const GEN3_CONSTANT_DEFAULTS = {
  inBattleOffset: 0x439,
  sideTimerSpikesOffset: 10,
  moneyMultiplierOffset: 0x4a,
  trainerMoneyEntrySize: 2,
} as const;
