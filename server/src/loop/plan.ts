import type {
  MemoryAddress,
  Platform,
  PointerAddress,
} from "@pokemon-memory-reader/internal/memory";
import { mapPointerValue } from "@pokemon-memory-reader/internal/memory";
import type { Range, ReadOutcome } from "../adapter/types";
import { Bytes } from "../format/bytes";
import type { Region, Regions } from "../format/regions";
import type { ReadJob } from "./job";

type PointerRegion = Extract<Region, { kind: "pointer" }>;

const wordKey = ({ at, width }: PointerAddress): string =>
  `${at.domain}:${at.offset}:${width}`;

/**
 * The last value read from each pointer word (spec §8.5). One cache belongs to one request: the
 * main batch keeps one per session, and the box request keeps its own. A word that was never
 * read is unknown. A word that read 0 is known, and null.
 */
export class PointerCache {
  readonly #values = new Map<string, number>();

  get(pointer: PointerAddress): number | undefined {
    return this.#values.get(wordKey(pointer));
  }

  set(pointer: PointerAddress, value: number): void {
    this.#values.set(wordKey(pointer), value);
  }
}

export interface PlanOptions {
  /** Ranges in one domain closer than this merge into one (spec §8.4). */
  readonly mergeGap: number;
  /** Maps the pointer values read from memory. */
  readonly platform: Platform;
  readonly pointers: PointerCache;
}

/** Why one part has no slices this cycle. Only the decoders that use the region fail (spec §8.5). */
export type SliceFailure =
  /** The range that covers a region failed on its own. */
  | "range_failed"
  /** The pointer value is 0 or maps to no memory. */
  | "null_pointer"
  /** The pointer word changed since the batch that addressed the region, so the bytes are stale. */
  | "pointer_moved"
  /** The pointer value was never read, or its word failed to read this cycle. */
  | "pointer_unread";

export type PartSlices =
  | { readonly ok: true; readonly slices: Record<string, Bytes> }
  | { readonly ok: false; readonly reason: SliceFailure };

export interface BatchPlan {
  readonly ranges: readonly Range[];
  /** Pointer words in the declared regions that have no known value, so no pointer region can be addressed yet. */
  readonly unknownPointers: boolean;
  /**
   * Turns the reply into per-part slices. Call it once: it stores the pointer values the reply
   * read, and the next plan addresses its regions with them.
   */
  sample(data: ReadonlyArray<Uint8Array | null>): BatchSample;
}

export interface BatchSample {
  /** The bytes of each named region of one part, or why that part has none this cycle. */
  slices(regions: Regions): PartSlices;
}

/** The cycle's reply was a timeout or a failed read, so there is no sample. */
export type CycleResult =
  | { readonly kind: "sample"; readonly sample: BatchSample }
  | {
      readonly kind: "no_data";
      readonly outcome: Exclude<ReadOutcome, { kind: "data" }>;
    };

/** Merges ranges within one domain only, closer than `mergeGap` (spec §8.4). */
function merge(wanted: readonly Range[], mergeGap: number): Range[] {
  const sorted = [...wanted].sort(
    (a, b) => a.domain.localeCompare(b.domain) || a.offset - b.offset,
  );
  const ranges: Range[] = [];
  for (const { domain, offset, length } of sorted) {
    const last = ranges.at(-1);
    if (
      last &&
      last.domain === domain &&
      offset <= last.offset + last.length + mergeGap
    ) {
      const end = Math.max(last.offset + last.length, offset + length);
      ranges[ranges.length - 1] = { ...last, length: end - last.offset };
    } else {
      ranges.push({ domain, offset, length });
    }
  }
  return ranges;
}

/** The bytes of `wanted` out of the merged ranges' replies, or null when its range failed. */
function locate(
  ranges: readonly Range[],
  data: ReadonlyArray<Uint8Array | null>,
  wanted: Range,
): Uint8Array | null {
  const index = ranges.findIndex(
    (range) =>
      range.domain === wanted.domain &&
      range.offset <= wanted.offset &&
      wanted.offset + wanted.length <= range.offset + range.length,
  );
  const range = ranges[index];
  const bytes = data[index];
  if (range === undefined || !bytes) return null;
  const start = wanted.offset - range.offset;
  return bytes.subarray(start, start + wanted.length);
}

const pointerRegions = (parts: readonly Regions[]): PointerRegion[] =>
  parts
    .flatMap((part) => Object.values(part))
    .filter((region): region is PointerRegion => region.kind === "pointer");

const wordRange = ({ at, width }: PointerAddress): Range => ({
  domain: at.domain,
  offset: at.offset,
  length: width,
});

/** The pointer words of these regions, one entry per distinct word. */
function uniqueWords(regions: readonly PointerRegion[]): PointerAddress[] {
  const words = new Map<string, PointerAddress>();
  for (const { at } of regions) words.set(wordKey(at), at);
  return [...words.values()];
}

/** Reads each word out of a reply and stores it in the cache. A word whose range failed keeps its old value. */
function learnWords(
  words: readonly PointerAddress[],
  ranges: readonly Range[],
  data: ReadonlyArray<Uint8Array | null>,
  pointers: PointerCache,
): Map<string, number> {
  const fresh = new Map<string, number>();
  for (const word of words) {
    const bytes = locate(ranges, data, wordRange(word));
    if (bytes === null) continue;
    const view = new Bytes(bytes);
    const value = word.width === 4 ? view.u32le(0) : view.u16le(0);
    fresh.set(wordKey(word), value);
    pointers.set(word, value);
  }
  return fresh;
}

/** The target of a pointer region for a pointer value, or null for a null or unmapped pointer. */
function target(
  platform: Platform,
  region: PointerRegion,
  value: number,
): MemoryAddress | null {
  const base = mapPointerValue(platform, value, region.at.bank);
  return (
    base && { domain: base.domain, offset: base.offset + region.at.offset }
  );
}

/**
 * One batch for the regions of every demanded part (spec §8.4, §8.5). Regions in one domain
 * closer than `mergeGap` share a range. A pointer region is addressed with the value the cache
 * holds, which an earlier batch read. The batch also reads the pointer words, and a region whose
 * word now holds another value is dropped from the sample.
 */
export function planBatch(
  parts: readonly Regions[],
  options: PlanOptions,
): BatchPlan {
  const { mergeGap, platform, pointers } = options;
  const regions = parts.flatMap((part) => Object.values(part));
  const pointed = pointerRegions(parts);
  const words = uniqueWords(pointed);

  const used = new Map<
    PointerRegion,
    { value: number; at: MemoryAddress | null }
  >();
  for (const region of pointed) {
    const value = pointers.get(region.at);
    if (value !== undefined)
      used.set(region, { value, at: target(platform, region, value) });
  }

  // A range that fails fails every region merged into it. A bad pointer can aim outside its
  // domain, so each word's targets merge only with each other, never with a static region.
  const fixed: Range[] = words.map(wordRange);
  const targets = new Map<string, Range[]>();
  for (const region of regions) {
    if (region.kind === "static") {
      fixed.push({ ...region.at, length: region.length });
    } else {
      const at = used.get(region)?.at;
      if (!at) continue;
      const key = wordKey(region.at);
      targets.set(key, [
        ...(targets.get(key) ?? []),
        { ...at, length: region.length },
      ]);
    }
  }
  const ranges = [
    ...merge(fixed, mergeGap),
    ...[...targets.values()].flatMap((group) => merge(group, mergeGap)),
  ];

  return {
    ranges,
    unknownPointers: pointed.some((region) => !used.has(region)),
    sample(data) {
      const fresh = learnWords(words, ranges, data, pointers);
      return {
        slices(part) {
          const out: Record<string, Bytes> = {};
          for (const [name, region] of Object.entries(part)) {
            let bytes: Uint8Array | null;
            if (region.kind === "static") {
              bytes = locate(ranges, data, {
                ...region.at,
                length: region.length,
              });
            } else {
              const before = used.get(region);
              if (before === undefined) return fail("pointer_unread");
              if (before.at === null) return fail("null_pointer");
              const now = fresh.get(wordKey(region.at));
              if (now === undefined) return fail("pointer_unread");
              if (now !== before.value) return fail("pointer_moved");
              bytes = locate(ranges, data, {
                ...before.at,
                length: region.length,
              });
            }
            if (bytes === null) return fail("range_failed");
            out[name] = new Bytes(bytes);
          }
          return { ok: true, slices: out };
        },
      };
    },
  };
}

const fail = (reason: SliceFailure): PartSlices => ({ ok: false, reason });

/**
 * The cycle's reads for these parts, as a job for the read loop (spec §8.5). When some pointer
 * word has no known value (attach, game change, cold read) it sends two requests in sequence:
 * the pointer words alone, then the batch addressed with the values they read, whose reply is
 * the sample. Otherwise it sends one. The box request starts the same job with its own regions
 * and its own cache.
 */
export function readBatch(
  parts: readonly Regions[],
  options: PlanOptions,
): ReadJob<CycleResult> {
  let stage: "start" | "words" | "batch" = "start";
  let plan: BatchPlan | null = null;
  const none = (outcome: ReadOutcome | null): { done: CycleResult } => ({
    done: {
      kind: "no_data",
      outcome:
        !outcome || outcome.kind === "data" ? { kind: "timeout" } : outcome,
    },
  });
  const wordsOnly = (): Range[] =>
    merge(uniqueWords(pointerRegions(parts)).map(wordRange), options.mergeGap);

  return {
    step(previous) {
      if (stage === "start") {
        const first = planBatch(parts, options);
        if (!first.unknownPointers) {
          stage = "batch";
          plan = first;
          return { read: first.ranges };
        }
        stage = "words";
        return { read: wordsOnly() };
      }
      if (previous?.kind !== "data") return none(previous);
      if (stage === "words") {
        const ranges = wordsOnly();
        learnWords(
          uniqueWords(pointerRegions(parts)),
          ranges,
          previous.slices,
          options.pointers,
        );
        stage = "batch";
        plan = planBatch(parts, options);
        return { read: plan.ranges };
      }
      return {
        done: {
          kind: "sample",
          sample: (plan as BatchPlan).sample(previous.slices),
        },
      };
    },
  };
}
