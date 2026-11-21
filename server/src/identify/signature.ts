import type { Range } from "../adapter/types";
import type { Profile } from "../profile/schema";

/** `status.game.signature` for a profile that declares one (spec §5.4, amendment 025 §3). */
export type SignatureResult = "match" | "mismatch" | "unchecked";

type Entry = NonNullable<Profile["identify"]>["signature"][number];

function wanted(entry: Entry): Uint8Array {
  const bytes = new Uint8Array(entry.bytes.length / 2);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = Number.parseInt(entry.bytes.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** The ROM range one entry checks. null for a pointer or a non-ROM address, which no signature may use. */
function rangeOf(entry: Entry): Range | null {
  const { address } = entry;
  if (!("domain" in address) || address.domain !== "rom") return null;
  return {
    domain: "rom",
    offset: address.offset,
    length: entry.bytes.length / 2,
  };
}

/** What a profile's signature needs read, and how to judge the bytes that come back. */
export interface SignaturePlan {
  readonly ranges: readonly Range[];
  /**
   * null when the profile declares no signature. Otherwise `slices` are the replies to `ranges`,
   * in order. A word that couldn't be read, or that sits at an address no read can reach, makes
   * the result "unchecked". A readable word that differs makes it "mismatch", whatever else is
   * unreadable.
   */
  judge(slices: readonly (Uint8Array | null)[]): SignatureResult | null;
}

export function planSignature(profile: Profile): SignaturePlan {
  const entries = profile.identify?.signature ?? [];
  const planned = entries.map((entry) => ({ entry, range: rangeOf(entry) }));
  const ranges = planned.flatMap(({ range }) => (range ? [range] : []));
  return {
    ranges,
    judge(slices) {
      if (entries.length === 0) return null;
      let next = 0;
      let unreadable = false;
      for (const { entry, range } of planned) {
        const got = range ? slices[next++] : null;
        const expected = wanted(entry);
        if (!got || got.length !== expected.length) {
          unreadable = true;
          continue;
        }
        if (expected.some((byte, i) => got[i] !== byte)) return "mismatch";
      }
      return unreadable ? "unchecked" : "match";
    },
  };
}
