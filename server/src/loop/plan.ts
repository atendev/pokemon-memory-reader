import type { Range } from "../adapter/types";
import { Bytes } from "../format/bytes";
import type { Region, Regions } from "../format/regions";

type StaticRegion = Extract<Region, { kind: "static" }>;

export interface BatchPlan {
  readonly ranges: readonly Range[];
  /** The bytes of each named region, or null when the range that covers it failed. */
  slices(
    regions: Regions,
    data: ReadonlyArray<Uint8Array | null>,
  ): Record<string, Bytes> | null;
}

/**
 * One batch for the static regions of every demanded part (spec §8.4). Regions in one domain
 * closer than `mergeGap` share a range. Pointer-derived regions (spec §8.5) are planned in a
 * second phase after their pointer words are read, which this tracer doesn't need yet.
 */
export function planBatch(
  regions: readonly Regions[],
  mergeGap: number,
): BatchPlan {
  const wanted = regions
    .flatMap((part) => Object.values(part))
    .filter((region): region is StaticRegion => region.kind === "static")
    .sort(
      (a, b) =>
        a.at.domain.localeCompare(b.at.domain) || a.at.offset - b.at.offset,
    );
  const ranges: Range[] = [];
  for (const { at, length } of wanted) {
    const last = ranges.at(-1);
    if (
      last &&
      last.domain === at.domain &&
      at.offset <= last.offset + last.length + mergeGap
    ) {
      const end = Math.max(last.offset + last.length, at.offset + length);
      ranges[ranges.length - 1] = { ...last, length: end - last.offset };
    } else {
      ranges.push({ domain: at.domain, offset: at.offset, length });
    }
  }

  return {
    ranges,
    slices(part, data) {
      const out: Record<string, Bytes> = {};
      for (const [name, region] of Object.entries(part)) {
        if (region.kind !== "static") return null;
        const index = ranges.findIndex(
          (range) =>
            range.domain === region.at.domain &&
            range.offset <= region.at.offset &&
            region.at.offset + region.length <= range.offset + range.length,
        );
        const range = ranges[index];
        const bytes = data[index];
        if (range === undefined || !bytes) return null;
        const start = region.at.offset - range.offset;
        out[name] = new Bytes(bytes.subarray(start, start + region.length));
      }
      return out;
    },
  };
}
