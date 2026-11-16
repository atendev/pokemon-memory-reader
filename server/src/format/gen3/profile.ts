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
    gBattleResources: gbaAny,
  })
  .strict();
