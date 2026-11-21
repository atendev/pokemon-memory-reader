import type { Party } from "@pokemon-memory-reader/api/schemas";
import type { Profile } from "../profile/schema";
import { referenceData } from "../reference";
import type { Bytes } from "./bytes";
import { gen3Decoder } from "./gen3";
import type { Regions, Slices } from "./regions";
import type { DecodeContext, ResourceDecoder, Result } from "./types";

export const GENERATION = { gen1: 1, gen2: 2, gen3: 3, cfru: 3 } as const;

/** A decoder part with its profile and per-game lookups already applied. */
export interface BoundPart<T> {
  readonly regions: Regions;
  /** Throws only on a layout bug, such as a slice read out of bounds. */
  decode(slices: Readonly<Record<string, Bytes>>): Result<T>;
}

/** What the read loop reads and decodes for the loaded game. A part left out makes its resource 503 `unsupported` (spec §7.2). */
export interface BoundGame {
  readonly party?: BoundPart<Party>;
}

function bind<P, R extends Regions, T>(
  decoder: ResourceDecoder<P, R, T>,
  profile: P,
  ctx: DecodeContext<P>,
): BoundPart<T> {
  return {
    regions: decoder.regions(profile),
    // The loop slices every declared region by name, so the record matches Slices<R>.
    decode: (slices) => decoder.decode(slices as Slices<R>, ctx),
  };
}

/** A decoder part's name with every region it declares at maximum size. */
export interface DeclaredPart {
  readonly part: string;
  readonly regions: Regions;
}

/**
 * What the loaded game's decoders read, split into the main batch and the box request (amendment
 * 026 §6). It needs no reference data, so a profile is measured the same whether or not its
 * language has any. Gen 3 has a box decoder, but the box request stays empty until the loop reads
 * boxes (ticket 066).
 */
export function declaredRegions(profile: Profile): {
  readonly main: readonly DeclaredPart[];
  readonly boxes: readonly DeclaredPart[];
} {
  switch (profile.dataFormat) {
    case "gen3":
      return {
        main: gen3Decoder.party
          ? [{ part: "party", regions: gen3Decoder.party.regions(profile) }]
          : [],
        boxes: [],
      };
    default:
      return { main: [], boxes: [] };
  }
}

/**
 * Binds the profile's data format to its decoder and the reference data for its language.
 * A format with no decoder, or no reference data, binds no parts. The `supported` flag and its
 * coverage guard (spec §6.1, §12.8) join this lookup when the fixtures land.
 */
export function bindGame(profile: Profile): BoundGame {
  const reference = referenceData(profile.dataFormat, profile.language);
  if (reference === null) return {};
  switch (profile.dataFormat) {
    case "gen3": {
      const ctx: DecodeContext<Profile<"gen3">> = {
        profile,
        ...reference,
        names: {
          ...reference.names,
          locations: reference.locations(profile.artVersion),
        },
      };
      return gen3Decoder.party
        ? { party: bind(gen3Decoder.party, profile, ctx) }
        : {};
    }
    default:
      return {};
  }
}
