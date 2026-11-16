import type { HeldBackDefinition } from "./definition";
import { brokenChain } from "./hashes";

export interface HoldBackOutcome {
  /** The line the generator prints. */
  readonly message: string;
  /** True when the chain is intact now, so the hold-back is stale and the revision can re-enter. */
  readonly repaired: boolean;
}

/** Decides what the generator says about a held-back revision. It never fails the run and never writes a profile. */
export function describeHoldBack(
  held: HeldBackDefinition,
  pretSha1s: readonly string[],
  noIntro: ReadonlyMap<string, ReadonlySet<string>>,
): HoldBackOutcome {
  const missing = brokenChain(pretSha1s, noIntro);
  if (missing.length === 0)
    return {
      message: `held back ${held.id}, but pret's SHA-1 now matches No-Intro. Take it out of heldBack in definitions.ts to ship it as chain or unconfirmed.`,
      repaired: true,
    };
  return {
    message: `held back ${held.id}: ${held.reason}. ${held.repo} ${held.sha1.file} lists ${missing.join(", ")}, which has no entry in ${held.noIntro.file}.`,
    repaired: false,
  };
}
