import type { GameInfo, Range, ReadOutcome } from "../adapter/types";
import type { ReadJob } from "../loop/job";
import type { ProfileRegistry, RomHeader } from "../profile/registry";
import type { Profile } from "../profile/schema";
import { headerRange, parseHeader } from "./header";
import { planSignature, type SignatureResult } from "./signature";

export type { SignatureResult };

/**
 * Automatic identification in the order of spec §5.4: exact hash, then header plus signature, then
 * header alone. The RHHEXP scan and manual picks slot in after it (amendment 014 §4).
 */
export type Identification =
  | {
      readonly kind: "identified";
      readonly profile: Profile;
      readonly match: "exact" | "header";
      /** null when the profile declares no signature. */
      readonly signature: SignatureResult | null;
      /** null when the adapter can't read ROM. */
      readonly header: RomHeader | null;
    }
  | {
      readonly kind: "unidentified";
      /**
       * `modified_rom`: the hash matched nothing while the header matches a base game, or a
       * header match failed its signature or couldn't be checked (spec §5.4).
       */
      readonly reason: "no_match" | "other_platform" | "modified_rom";
      readonly header: RomHeader | null;
    };

/** The profiles the emulator's hash names: its SHA-1 when it gives one, else its CRC32 (amendment 014 §1). */
function byHash(game: GameInfo, registry: ProfileRegistry): readonly Profile[] {
  if (game.sha1 !== null)
    return registry.byHash({ sha1: game.sha1, crc32: null });
  if (game.crc32 === null) return [];
  return registry.byHash({ sha1: null, crc32: game.crc32 });
}

const hasHash = (game: GameInfo) => game.sha1 !== null || game.crc32 !== null;

const declaresSignature = (profile: Profile) =>
  (profile.identify?.signature.length ?? 0) > 0;

function identified(
  profile: Profile,
  match: "exact" | "header",
  signature: SignatureResult | null,
  header: RomHeader | null,
): Identification {
  return { kind: "identified", profile, match, signature, header };
}

/**
 * The header-match step for a ROM the emulator gave no hash for. A profile whose signature
 * matched wins over one that declares none. A signature that fails or can't be read counts as a
 * modified ROM, and several equal matches stay unidentified (spec §5.4).
 */
function byHeader(
  header: RomHeader,
  candidates: readonly Profile[],
  signatures: ReadonlyMap<Profile, SignatureResult | null>,
): Identification {
  const failed = candidates.some((p) => {
    const result = signatures.get(p);
    return result === "mismatch" || result === "unchecked";
  });
  const sure = candidates.filter((p) => signatures.get(p) === "match");
  // A failed signature on a shared header means the ROM is modified, so an unsigned profile on that header doesn't take it.
  const bare = failed ? [] : candidates.filter((p) => !declaresSignature(p));
  const [pick, ...rest] = sure.length > 0 ? sure : bare;
  if (pick !== undefined && rest.length === 0)
    return identified(pick, "header", sure.length > 0 ? "match" : null, header);
  return {
    kind: "unidentified",
    reason: failed ? "modified_rom" : "no_match",
    header,
  };
}

/**
 * Reads the header and checks signatures, then identifies. Finishes with null when a read gave
 * nothing this time, so the loop tries again on its next tick. A ROM the adapter can't read is
 * identified by hash alone, with its signature "unchecked".
 */
export function identification(
  game: GameInfo,
  registry: ProfileRegistry,
): ReadJob<Identification | null> {
  if (game.platform === "other")
    return {
      step: () => ({
        done: { kind: "unidentified", reason: "other_platform", header: null },
      }),
    };
  const { platform } = game;
  const hashed = byHash(game, registry);
  const exact = hashed.length === 1 ? hashed[0] : undefined;
  const exactPlan = exact && planSignature(exact);

  if (game.domains.rom === undefined) {
    return {
      step: () => ({
        done: exact
          ? identified(
              exact,
              "exact",
              declaresSignature(exact) ? "unchecked" : null,
              null,
            )
          : { kind: "unidentified", reason: "no_match", header: null },
      }),
    };
  }

  let phase: "header" | "signatures" = "header";
  let header: RomHeader | null = null;
  let candidates: readonly Profile[] = [];
  let plans: ReadonlyArray<ReturnType<typeof planSignature>> = [];

  /** Each candidate's signature result from the replies to its plan's ranges, laid end to end. */
  function judgeAll(
    slices: readonly (Uint8Array | null)[],
  ): Map<Profile, SignatureResult | null> {
    let at = 0;
    const results = new Map<Profile, SignatureResult | null>();
    candidates.forEach((profile, i) => {
      const plan = plans[i];
      if (!plan) return;
      const count = plan.ranges.length;
      results.set(profile, plan.judge(slices.slice(at, at + count)));
      at += count;
    });
    return results;
  }

  const data = (outcome: ReadOutcome) =>
    outcome.kind === "data" ? outcome.slices : null;

  return {
    step(previous) {
      if (previous === null)
        return {
          read: [headerRange(platform), ...(exactPlan?.ranges ?? [])],
        };
      const slices = data(previous);
      if (slices === null) return { done: null };

      if (phase === "header") {
        const bytes = slices[0];
        header = bytes ? parseHeader(platform, bytes) : null;
        if (exact && exactPlan)
          return {
            done: identified(
              exact,
              "exact",
              exactPlan.judge(slices.slice(1)),
              header,
            ),
          };
        if (hashed.length > 1)
          return { done: { kind: "unidentified", reason: "no_match", header } };
        candidates = header ? registry.byHeader(header) : [];
        if (hasHash(game))
          return {
            done: {
              kind: "unidentified",
              reason: candidates.length > 0 ? "modified_rom" : "no_match",
              header,
            },
          };
        plans = candidates.map(planSignature);
        if (header === null)
          return { done: { kind: "unidentified", reason: "no_match", header } };
        const ranges: Range[] = plans.flatMap((plan) => plan.ranges);
        if (ranges.length > 0) {
          phase = "signatures";
          return { read: ranges };
        }
        return { done: byHeader(header, candidates, judgeAll([])) };
      }

      return {
        done: byHeader(header as RomHeader, candidates, judgeAll(slices)),
      };
    },
  };
}
