import type { GameInfo } from "../adapter/types";
import type { ReadJob } from "../loop/job";
import type { ProfileRegistry, RomHeader } from "../profile/registry";
import type { Profile } from "../profile/schema";
import { headerRange, parseHeader } from "./header";

/**
 * The tracer's identification: header only (spec §5.4). Exact hash, the signature check, the
 * "modified ROM" rule, manual picks and the RHHEXP scan slot in ahead of and after the header
 * match, in the order of spec §5.4 and amendment 014. Until then `signature` is "unchecked" for
 * a profile that declares one and null for one that doesn't.
 */
export type Identification =
  | {
      readonly kind: "identified";
      readonly profile: Profile;
      readonly match: "header";
      readonly signature: "unchecked" | null;
      readonly header: RomHeader;
    }
  | {
      readonly kind: "unidentified";
      readonly reason: "no_match" | "other_platform";
      readonly header: RomHeader | null;
    };

/** Pure. A header that matches exactly one profile identifies it. Several matches stay unidentified. */
export function identifyByHeader(
  game: GameInfo,
  header: RomHeader | null,
  registry: ProfileRegistry,
): Identification {
  if (game.platform === "other")
    return { kind: "unidentified", reason: "other_platform", header: null };
  if (header === null)
    return { kind: "unidentified", reason: "no_match", header };
  const matches = registry.byHeader(header);
  const [profile] = matches;
  if (matches.length !== 1 || profile === undefined)
    return { kind: "unidentified", reason: "no_match", header };
  return {
    kind: "identified",
    profile,
    match: "header",
    signature: profile.identify?.signature.length ? "unchecked" : null,
    header,
  };
}

/**
 * Reads the header and identifies. Finishes with null when the read gave nothing this time, so
 * the loop tries again on its next tick.
 */
export function identification(
  game: GameInfo,
  registry: ProfileRegistry,
): ReadJob<Identification | null> {
  return {
    step(previous) {
      if (game.platform === "other" || game.domains.rom === undefined)
        return { done: identifyByHeader(game, null, registry) };
      if (previous === null) return { read: [headerRange(game.platform)] };
      if (previous.kind === "timeout") return { done: null };
      if (previous.kind === "failed") return { done: null };
      const bytes = previous.slices[0];
      const header = bytes ? parseHeader(game.platform, bytes) : null;
      return { done: identifyByHeader(game, header, registry) };
    },
  };
}
