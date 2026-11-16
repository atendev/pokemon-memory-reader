import type { Party } from "@pokemon-memory-reader/api/schemas";
import type { Profile } from "../../profile/schema";
import { type Region, region } from "../regions";
import { fail, ok, type ResourceDecoder } from "../types";
import { decodePartyMon } from "./mon";
import { PARTY_MAX, PARTY_MON } from "./structs";

interface PartyRegions {
  readonly [name: string]: Region;
  readonly count: Region;
  readonly party: Region;
}

/**
 * The player's party: the count byte, then that many 100-byte mons. A slot beyond the count is
 * empty. A bad checksum, a bad egg or species 0 inside the count fails the whole party, because the
 * game is mid-write or the memory isn't a party (interfaces 004).
 */
export const gen3Party: ResourceDecoder<
  Profile<"gen3">,
  PartyRegions,
  Party
> = {
  regions: (profile) => ({
    count: region(profile.addresses.gPlayerPartyCount, 1),
    party: region(profile.addresses.gPlayerParty, PARTY_MAX * PARTY_MON.size),
  }),
  decode({ count, party }, ctx) {
    const size = count.u8(0);
    if (size > PARTY_MAX)
      return fail(`party count ${size} is above ${PARTY_MAX}`);
    const pokemon: Party["pokemon"] = [];
    for (let slot = 0; slot < size; slot++) {
      const decoded = decodePartyMon(
        party.sub(slot * PARTY_MON.size, PARTY_MON.size),
        ctx,
      );
      if (!decoded.ok) return fail(`party slot ${slot}: ${decoded.reason}`);
      pokemon.push(decoded.value);
    }
    return ok({ pokemon });
  },
};
