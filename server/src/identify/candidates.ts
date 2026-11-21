import type { PickCandidate } from "@pokemon-memory-reader/internal/manual-picks-route";
import type { GameInfo, Range, ReadOutcome } from "../adapter/types";
import type { ProfileRegistry, RomHeader } from "../profile/registry";
import { type Profile, platformOf } from "../profile/schema";
import { baseEligible, type SignatureResult } from "./identify";
import { planSignature } from "./signature";

/** One signature request holds at most this many ranges and bytes, well inside every bridge cap (spec §4.5). */
const CHUNK_RANGES = 64;
const CHUNK_BYTES = 4096;

/** The profiles a ROM of this platform may be picked for: GB covers gb and gbc (amendment 021, item 8). */
export function profilesFor(
  registry: ProfileRegistry,
  game: Pick<GameInfo, "platform">,
): readonly Profile[] {
  return registry
    .all()
    .filter((profile) => platformOf[profile.dataFormat] === game.platform);
}

export interface Signatures {
  readonly results: ReadonlyMap<string, SignatureResult | null>;
  /** False when a read gave nothing, so some "unchecked" results only mean "not read yet" and the caller shouldn't keep them. */
  readonly complete: boolean;
}

/**
 * Checks every profile's signature against the ROM. The reads go out in small requests through
 * `read`, which is the loop's one request slot, so a tick waits for at most one of them. A profile
 * that declares no signature gets null, and any profile is "unchecked" when the adapter reads no ROM.
 */
export async function readSignatures(
  profiles: readonly Profile[],
  game: Pick<GameInfo, "domains">,
  read: (ranges: readonly Range[]) => Promise<ReadOutcome>,
): Promise<Signatures> {
  const results = new Map<string, SignatureResult | null>();
  const plans = profiles.map((profile) => ({
    profile,
    plan: planSignature(profile),
  }));
  const readable = game.domains.rom !== undefined;
  let complete = true;

  let batch: typeof plans = [];
  let ranges = 0;
  let bytes = 0;
  const flush = async () => {
    const mine = batch;
    batch = [];
    ranges = 0;
    bytes = 0;
    if (mine.length === 0) return;
    const outcome = await read(mine.flatMap(({ plan }) => plan.ranges));
    const slices = outcome.kind === "data" ? outcome.slices : null;
    if (slices === null) complete = false;
    let at = 0;
    for (const { profile, plan } of mine) {
      const count = plan.ranges.length;
      results.set(
        profile.id,
        plan.judge(slices ? slices.slice(at, at + count) : []),
      );
      at += count;
    }
  };

  for (const entry of plans) {
    const { profile, plan } = entry;
    if (plan.ranges.length === 0 || !readable) {
      // Nothing to read, or nothing that can be: the plan judges an empty reply.
      results.set(profile.id, plan.judge([]));
      continue;
    }
    const size = plan.ranges.reduce((sum, range) => sum + range.length, 0);
    if (
      batch.length > 0 &&
      (ranges + plan.ranges.length > CHUNK_RANGES || bytes + size > CHUNK_BYTES)
    )
      await flush();
    batch.push(entry);
    ranges += plan.ranges.length;
    bytes += size;
  }
  await flush();
  return { results, complete };
}

/** The candidate rows for the ROM loaded now: header matches first, then by name (amendment 021, item 8). */
export function candidateRows(
  profiles: readonly Profile[],
  game: GameInfo,
  header: RomHeader | null,
  registry: ProfileRegistry,
  signatures: ReadonlyMap<string, SignatureResult | null>,
): PickCandidate[] {
  const named = new Set(header ? registry.byHeader(header) : []);
  return profiles
    .map((profile): PickCandidate => {
      const headerMatch = named.has(profile);
      const signature = signatures.get(profile.id) ?? null;
      return {
        id: profile.id,
        name: profile.name,
        kind: profile.kind,
        dataFormat: profile.dataFormat,
        headerMatch,
        signature,
        baseEligible: baseEligible(game, headerMatch, signature),
      };
    })
    .sort(
      (a, b) =>
        Number(b.headerMatch) - Number(a.headerMatch) ||
        (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
}
