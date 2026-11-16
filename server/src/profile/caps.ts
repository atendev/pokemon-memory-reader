import type { DeclaredPart } from "../format/registry";

export interface BatchCaps {
  readonly maxRanges: number;
  readonly maxBytes: number;
  readonly mergeGap: number;
}

/**
 * Measures one request against the bridge caps (amendment 026 §6). The range count is the
 * unmerged count and the bytes add the merge gap once per possible merge. A pointer region counts
 * its pointer word and its target at the declared length. A `rom` range over the byte cap is left
 * out, because the adapter splits those into their own requests (spec §4.4). Returns a message, or
 * null when the request fits.
 */
export function checkRequestCaps(
  request: string,
  parts: readonly DeclaredPart[],
  caps: BatchCaps,
): string | null {
  const ranges: Array<{ label: string; length: number }> = [];
  for (const { part, regions } of parts) {
    for (const [name, region] of Object.entries(regions)) {
      const label = `${part}.${name}`;
      if (region.kind === "static") {
        const wholeRom =
          region.at.domain === "rom" && region.length > caps.maxBytes;
        if (!wholeRom) ranges.push({ label, length: region.length });
      } else {
        // The target's domain isn't known until read time, so it is never left out as a whole-rom range.
        ranges.push({ label: `${label} pointer`, length: region.at.width });
        ranges.push({ label, length: region.length });
      }
    }
  }
  if (ranges.length === 0) return null;
  const bytes =
    ranges.reduce((sum, range) => sum + range.length, 0) +
    caps.mergeGap * (ranges.length - 1);
  if (ranges.length <= caps.maxRanges && bytes <= caps.maxBytes) return null;
  const largest = ranges.reduce((a, b) => (b.length > a.length ? b : a));
  return `${request} needs ${ranges.length} ranges and up to ${bytes} bytes, over the bridge cap of ${caps.maxRanges} ranges and ${caps.maxBytes} bytes (largest region ${largest.label}, ${largest.length} bytes)`;
}
