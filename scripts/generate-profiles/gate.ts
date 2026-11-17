import {
  type FailureEntry,
  failureProblems,
  type LedgerEntry,
  ledgerProblems,
  rateSignatureEvidence,
  type SignatureEvidence,
} from "./evidence";

/** The fields of a built-in profile file that the release gate reads. */
export interface ShippedProfile {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly identify?: {
    readonly sha1: readonly string[];
    readonly crc32: readonly string[];
    readonly signature?: readonly unknown[];
  };
  readonly provenance?: {
    readonly kind: string;
    readonly repo?: string;
    readonly signatureEvidence?: string;
  };
}

const LEVELS: readonly string[] = ["owner", "chain", "unconfirmed"];

/**
 * Amendment 022 items 7 and 8. Returns every reason the release candidate or `v2.0.0` must not ship: an
 * unresolved failed owner check in a shipped profile's repo, a shipped official profile with signature words and a missing or wrong `signatureEvidence`, a stale ledger entry,
 * an official built-in with no No-Intro CRC32 beside each SHA-1 (a broken chain), a held-back revision in
 * the built-in set, or release notes text that leaves out a profile that isn't `owner`.
 */
export function releaseGateProblems(
  shipped: readonly ShippedProfile[],
  ledger: readonly LedgerEntry[],
  failures: readonly FailureEntry[],
  heldBackIds: readonly string[],
  notesText: string,
): string[] {
  const problems: string[] = [];
  const signed = shipped.filter(
    (p) =>
      p.kind === "official" &&
      p.identify !== undefined &&
      (p.identify.signature?.length ?? 0) > 0,
  );
  const rated = signed.map((p) => ({
    id: p.id,
    repo: p.provenance?.repo ?? "",
    sha1: p.identify?.sha1 ?? [],
  }));
  problems.push(...ledgerProblems(rated, ledger));
  problems.push(
    ...failureProblems(
      shipped.map((p) => ({
        id: p.id,
        repo: p.provenance?.repo ?? "",
        sha1: p.identify?.sha1 ?? [],
      })),
      failures,
    ),
  );
  const expected = rateSignatureEvidence(rated, ledger);

  for (const p of signed) {
    const have = p.provenance?.signatureEvidence;
    if (have === undefined || !LEVELS.includes(have))
      problems.push(`${p.id} has no signatureEvidence rating`);
    else if (have !== expected.get(p.id))
      problems.push(
        `${p.id} is rated ${have}, but the ledger and SHA-1 data give ${expected.get(p.id)}`,
      );
  }
  for (const p of shipped.filter((q) => q.kind === "official" && q.identify))
    if (
      (p.identify?.sha1.length ?? 0) === 0 ||
      p.identify?.crc32.length !== p.identify?.sha1.length
    )
      problems.push(
        `${p.id} has a SHA-1 with no No-Intro CRC32: a broken chain`,
      );
  for (const id of heldBackIds)
    if (shipped.some((p) => p.id === id))
      problems.push(`${id} is held back but is in the built-in set`);

  const levelled = signed.map((p) => ({
    id: p.id,
    name: p.name,
    level: (expected.get(p.id) ?? "unconfirmed") as SignatureEvidence,
  }));
  for (const p of levelled.filter((q) => q.level !== "owner"))
    if (!notesText.includes(`- ${p.name} (${p.id}): ${p.level}`))
      problems.push(`the release notes leave out ${p.id} (${p.level})`);
  return problems;
}
