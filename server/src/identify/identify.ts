import type { GameInfo, Range, ReadOutcome } from "../adapter/types";
import type { Log } from "../log";
import type { ReadJob } from "../loop/job";
import type { ProfileRegistry, RomHeader } from "../profile/registry";
import { type Profile, platformOf } from "../profile/schema";
import { headerRange, parseHeader } from "./header";
import { baseKey, type PickKey, romKeys } from "./pick-keys";
import type { PickStore } from "./pick-store";
import { planSignature, type SignatureResult } from "./signature";

export type { SignatureResult };

/** The pick that identified a ROM: its scope, and the keys that hold it, which forgetting removes (amendment 014 §4). Empty when the pick lasts for the session only. */
export interface AppliedPick {
  readonly scope: "rom" | "base";
  readonly keys: readonly PickKey[];
}

/**
 * Identification in the order of spec §5.4: exact hash, then header plus signature, then header
 * alone, then a manual pick (amendment 014 §4). The RHHEXP scan slots in before the pick.
 */
export type Identification =
  | {
      readonly kind: "identified";
      readonly profile: Profile;
      readonly match: "exact" | "header" | "manual";
      /** null when the profile declares no signature. */
      readonly signature: SignatureResult | null;
      /** null when the adapter can't read ROM. */
      readonly header: RomHeader | null;
      /** Set for `match: "manual"`. */
      readonly pick?: AppliedPick;
      /** The base-pick candidates, see `Unidentified.eligible`. Set for `match: "manual"`. */
      readonly eligible?: readonly Profile[];
    }
  | {
      readonly kind: "unidentified";
      /**
       * `modified_rom`: the hash matched nothing while the header matches a base game, or a
       * header match failed its signature or couldn't be checked (spec §5.4).
       */
      readonly reason: "no_match" | "other_platform" | "modified_rom";
      readonly header: RomHeader | null;
      /**
       * The profiles a base-game pick may name (amendment 014 §3): the emulator gave a hash, the
       * header matched, and the signature passed or the profile declares none. Set only when
       * the pick lookup ran.
       */
      readonly eligible?: readonly Profile[];
    };

/** A pick the user made for this ROM that lasts for the session only, because no key was available or the file didn't take it. */
export interface SessionPick {
  readonly profileId: string;
  readonly scope: "rom" | "base";
}

export interface PickInputs {
  readonly store: Pick<PickStore, "lookup">;
  readonly session: SessionPick | null;
  readonly log: Log;
}

/** The profiles the emulator's hash names: its SHA-1 when it gives one, else its CRC32 (amendment 014 §1). */
function byHash(game: GameInfo, registry: ProfileRegistry): readonly Profile[] {
  if (game.sha1 !== null)
    return registry.byHash({ sha1: game.sha1, crc32: null });
  if (game.crc32 === null) return [];
  return registry.byHash({ sha1: null, crc32: game.crc32 });
}

const hasHash = (game: GameInfo) => game.sha1 !== null || game.crc32 !== null;

/**
 * Whether a profile may take a base-game pick for this ROM (amendment 014 §3): the emulator gave a
 * hash, the adapter reads ROM, the header names the profile, and the signature passed or the
 * profile declares none. Both the pick lookup and `GET /manual-picks` decide it here.
 */
export function baseEligible(
  game: GameInfo,
  headerMatch: boolean,
  signature: SignatureResult | null,
): boolean {
  return (
    hasHash(game) &&
    game.domains.rom !== undefined &&
    headerMatch &&
    (signature === null || signature === "match")
  );
}

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
function automatic(
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

/** A profile of the ROM's own platform that the registry holds. */
const usable = (
  registry: ProfileRegistry,
  game: GameInfo,
  id: string,
): Profile | null => {
  const profile = registry.get(id);
  return profile && platformOf[profile.dataFormat] === game.platform
    ? profile
    : null;
};

/**
 * Identification with manual picks (amendment 014 §4). Automatic identification runs first. When it
 * leaves the ROM unidentified, the base-pick candidates are found (a second read for their
 * signatures) and a pick is looked up: the session pick, then the ROM key, then `base:<P>` for the one
 * candidate that has an entry. A pick whose profile isn't loaded is skipped with a warning and the ROM
 * stays unidentified. The picked profile's signature is judged by one more read, so a pick that
 * went against a failed signature still loads with `"mismatch"`.
 */
export function identification(
  game: GameInfo,
  registry: ProfileRegistry,
  picks?: PickInputs,
): ReadJob<Identification | null> {
  const auto = automatic(game, registry);
  if (!picks || game.platform === "other") return auto;

  type Unidentified = Extract<Identification, { kind: "unidentified" }>;
  type Step =
    | { readonly read: readonly Range[] }
    | { readonly done: Identification | null };
  let stage: "auto" | "eligible" | "signature" = "auto";
  let found: Unidentified | null = null;
  let candidates: readonly Profile[] = [];
  let plans: ReadonlyArray<ReturnType<typeof planSignature>> = [];
  let eligible: Profile[] = [];
  let chosen: { profile: Profile; applied: AppliedPick } | null = null;

  const manual = (
    signature: SignatureResult | null,
    unidentified: Unidentified,
  ): Identification => ({
    kind: "identified",
    profile: (chosen as NonNullable<typeof chosen>).profile,
    match: "manual",
    signature,
    header: unidentified.header,
    pick: (chosen as NonNullable<typeof chosen>).applied,
    eligible,
  });

  function choose(keys: readonly PickKey[]): typeof chosen {
    const { session, store, log } = picks as PickInputs;
    const skip = (id: string) => {
      log.warn(
        `the manual pick of profile ${id} is skipped because that profile is not loaded for this ROM's platform`,
      );
      return null;
    };
    if (session) {
      const profile = usable(registry, game, session.profileId);
      if (!profile) return skip(session.profileId);
      if (session.scope === "rom")
        return { profile, applied: { scope: "rom", keys } };
      return eligible.includes(profile)
        ? { profile, applied: { scope: "base", keys: [baseKey(profile.id)] } }
        : null;
    }
    const hit = store.lookup(keys);
    if (hit) {
      const profile = usable(registry, game, hit.profileId);
      return profile
        ? { profile, applied: { scope: "rom", keys } }
        : skip(hit.profileId);
    }
    const based = eligible.filter((p) => store.lookup([baseKey(p.id)]));
    const [only, ...rest] = based;
    return only && rest.length === 0
      ? { profile: only, applied: { scope: "base", keys: [baseKey(only.id)] } }
      : null;
  }

  const candidateSlices = new Map<Profile, readonly (Uint8Array | null)[]>();

  /** Looks the pick up once the base-pick candidates are known. */
  function decide(unidentified: Unidentified): Step {
    const keys = romKeys(game, unidentified.header);
    chosen = choose(keys);
    if (!chosen) return { done: { ...unidentified, eligible } };
    if (chosen.applied.scope === "base")
      return {
        done: manual(
          planSignature(chosen.profile).judge(
            candidateSlices.get(chosen.profile) ?? [],
          ),
          unidentified,
        ),
      };
    const plan = planSignature(chosen.profile);
    if (game.domains.rom === undefined)
      return {
        done: manual(
          (chosen.profile.identify?.signature.length ?? 0) > 0
            ? "unchecked"
            : null,
          unidentified,
        ),
      };
    if (plan.ranges.length === 0)
      return { done: manual(plan.judge([]), unidentified) };
    stage = "signature";
    return { read: plan.ranges };
  }

  return {
    step(previous) {
      if (stage === "auto") {
        const step = auto.step(previous);
        if ("read" in step) return step;
        const done = step.done;
        if (
          done === null ||
          done.kind === "identified" ||
          done.reason === "other_platform"
        )
          return { done };
        found = done;
        const hashed = game.sha1 !== null || game.crc32 !== null;
        candidates =
          hashed && done.header !== null && game.domains.rom !== undefined
            ? registry.byHeader(done.header)
            : [];
        plans = candidates.map(planSignature);
        const ranges: Range[] = plans.flatMap((plan) => plan.ranges);
        if (ranges.length > 0) {
          stage = "eligible";
          return { read: ranges };
        }
        eligible = candidates.filter((_, i) =>
          baseEligible(game, true, plans[i]?.judge([]) ?? null),
        );
        return decide(found);
      }
      if (previous === null) return { done: null };
      const slices = previous.kind === "data" ? previous.slices : null;
      if (stage === "eligible") {
        if (slices === null) return { done: null };
        let at = 0;
        candidates.forEach((profile, i) => {
          const plan = plans[i];
          if (!plan) return;
          const mine = slices.slice(at, at + plan.ranges.length);
          at += plan.ranges.length;
          candidateSlices.set(profile, mine);
          const result = plan.judge(mine);
          if (baseEligible(game, true, result)) eligible.push(profile);
        });
        return decide(found as Unidentified);
      }
      // The picked profile's signature, read after the pick was found.
      if (slices === null) return { done: null };
      const plan = planSignature(
        (chosen as NonNullable<typeof chosen>).profile,
      );
      return { done: manual(plan.judge(slices), found as Unidentified) };
    },
  };
}
