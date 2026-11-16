export interface RomHashes {
  readonly sha1: readonly string[];
  readonly crc32: readonly string[];
}

/** The SHA-1 values in a pret `sha1sum` file, lowercase, in file order. Fails on a file with none. */
export function parsePretSha1(text: string, file: string): string[] {
  const found = text
    .split("\n")
    .map((line) => line.trim().split(/\s+/)[0]?.toLowerCase() ?? "")
    .filter((hash) => /^[0-9a-f]{40}$/.test(hash));
  if (found.length === 0) throw new Error(`${file} lists no SHA-1`);
  return found;
}

const ROM_LINE =
  /\brom\s*\(\s*name\s+"([^"]*)"\s+size\s+\d+\s+crc\s+([0-9A-Fa-f]{8})\s+md5\s+[0-9A-Fa-f]{32}\s+sha1\s+([0-9A-Fa-f]{40})/g;

/** SHA-1 to the CRC32 values of the No-Intro entries that carry it, both lowercase. */
export function parseNoIntroDat(text: string): Map<string, Set<string>> {
  const bySha1 = new Map<string, Set<string>>();
  for (const [, , crc, sha1] of text.matchAll(ROM_LINE)) {
    if (!crc || !sha1) continue;
    const key = sha1.toLowerCase();
    const crcs = bySha1.get(key) ?? new Set<string>();
    crcs.add(crc.toLowerCase());
    bySha1.set(key, crcs);
  }
  return bySha1;
}

/** The pret SHA-1 values with no No-Intro entry. A non-empty result is a broken chain (amendment 022 item 2). */
export function brokenChain(
  sha1s: readonly string[],
  noIntro: ReadonlyMap<string, ReadonlySet<string>>,
): string[] {
  return sha1s.filter((sha1) => !noIntro.has(sha1));
}

/**
 * Pairs each pret SHA-1 with the CRC32 of the No-Intro entry that has the same SHA-1 (amendment 019 §7).
 * A SHA-1 with no entry, or with entries that disagree on the CRC32, fails the generator.
 */
export function resolveHashes(
  sha1s: readonly string[],
  noIntro: ReadonlyMap<string, ReadonlySet<string>>,
  source: { readonly pret: string; readonly noIntro: string },
): RomHashes {
  const crc32 = sha1s.map((sha1) => {
    const crcs = [...(noIntro.get(sha1) ?? [])];
    const [only] = crcs;
    if (only === undefined)
      throw new Error(
        `No-Intro ${source.noIntro} has no entry with SHA-1 ${sha1} (listed in ${source.pret}). Move the pinned DAT commit forward, or hold the revision back in heldBack in definitions.ts until the chain is repaired or the owner's ROM passes (amendment 022 item 4).`,
      );
    if (crcs.length > 1)
      throw new Error(
        `No-Intro ${source.noIntro} has entries with SHA-1 ${sha1} but different CRC32 values: ${crcs.join(", ")}`,
      );
    return only;
  });
  return { sha1: sha1s, crc32 };
}
