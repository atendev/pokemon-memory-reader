export type SignatureEvidence = "owner" | "chain" | "unconfirmed";

/** One passing signature check on the owner's retail ROM. Hashes only, never ROM bytes. */
export interface LedgerEntry {
  readonly profileId: string;
  readonly sha1: string;
  /** `YYYY-MM-DD`, UTC. */
  readonly date: string;
}

/** The parts of a shipped official profile that decide its evidence level. */
export interface RatedProfile {
  readonly id: string;
  /** The pret repo the profile's symbols come from. One owned revision confirms the generator's mapping for the whole repo. */
  readonly repo: string;
  /** `identify.sha1`. */
  readonly sha1: readonly string[];
}

const SHA1 = /^[0-9a-f]{40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KEYS = ["date", "profileId", "sha1"];

function checkEntry(value: unknown, where: string): LedgerEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${where} is not an object`);
  const keys = Object.keys(value).sort();
  if (keys.join() !== KEYS.join())
    throw new Error(`${where} must have exactly ${KEYS.join(", ")}`);
  const { profileId, sha1, date } = value as Record<string, unknown>;
  if (typeof profileId !== "string" || profileId === "")
    throw new Error(`${where} has no profileId`);
  if (typeof sha1 !== "string" || !SHA1.test(sha1))
    throw new Error(`${where} sha1 is not 40 lowercase hex digits`);
  if (
    typeof date !== "string" ||
    !DATE.test(date) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  )
    throw new Error(`${where} date is not a real YYYY-MM-DD date`);
  return { profileId, sha1, date };
}

/** Reads the committed ledger. Anything that is not a list of exact entries fails, so a bad hand edit never rates a profile. */
export function parseLedger(text: string): LedgerEntry[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("the ledger is not a list");
  return parsed.map((entry, i) => checkEntry(entry, `ledger entry ${i}`));
}

/** Sorted so a recorded run and a hand merge give the same file. */
export function renderLedger(entries: readonly LedgerEntry[]): string {
  const sorted = [...entries].sort((a, b) =>
    `${a.profileId} ${a.date} ${a.sha1}`.localeCompare(
      `${b.profileId} ${b.date} ${b.sha1}`,
    ),
  );
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

/** What `test:local --record` calls after a passing signature check. A repeat check of the same profile and ROM keeps the first entry. */
export function appendLedgerEntry(
  entries: readonly LedgerEntry[],
  entry: LedgerEntry,
): LedgerEntry[] {
  const checked = checkEntry(entry, "the new entry");
  const known = entries.some(
    (e) => e.profileId === checked.profileId && e.sha1 === checked.sha1,
  );
  return known ? [...entries] : [...entries, checked];
}

/**
 * Ledger entries that name a shipped profile but a SHA-1 outside its `identify.sha1`. Such an entry can't
 * make the profile `owner`, so it is a mistake in the ledger or in the profile.
 */
export function ledgerProblems(
  profiles: readonly RatedProfile[],
  ledger: readonly LedgerEntry[],
): string[] {
  const problems: string[] = [];
  for (const entry of ledger) {
    const profile = profiles.find((p) => p.id === entry.profileId);
    if (profile && !profile.sha1.includes(entry.sha1))
      problems.push(
        `ledger entry for ${entry.profileId} has SHA-1 ${entry.sha1}, which the profile's identify.sha1 doesn't list`,
      );
  }
  return problems;
}

/**
 * Amendment 022 item 2. `owner` needs a ledger entry whose SHA-1 the profile lists. `chain` needs another
 * shipped revision from the same pret repo at `owner`. Everything else is `unconfirmed`. Every profile passed
 * in has an intact chain, because the generator fails or holds back a revision whose pret SHA-1 has no
 * No-Intro entry.
 */
export function rateSignatureEvidence(
  profiles: readonly RatedProfile[],
  ledger: readonly LedgerEntry[],
): ReadonlyMap<string, SignatureEvidence> {
  const owned = new Set(
    profiles
      .filter((p) =>
        ledger.some((e) => e.profileId === p.id && p.sha1.includes(e.sha1)),
      )
      .map((p) => p.id),
  );
  const ownedRepos = new Set(
    profiles.filter((p) => owned.has(p.id)).map((p) => p.repo),
  );
  return new Map(
    profiles.map((p): [string, SignatureEvidence] => [
      p.id,
      owned.has(p.id)
        ? "owner"
        : ownedRepos.has(p.repo)
          ? "chain"
          : "unconfirmed",
    ]),
  );
}

/** The release-notes section for amendment 022 item 8: every shipped profile whose level isn't `owner`. */
export function renderEvidenceNotes(
  profiles: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly level: SignatureEvidence;
  }>,
): string {
  const lines = profiles
    .filter((p) => p.level !== "owner")
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => `- ${p.name} (${p.id}): ${p.level}`);
  return [
    "### Signature evidence",
    "",
    ...(lines.length > 0
      ? [
          "These profiles' signatures were not checked on the owner's retail ROM. `chain` means another revision from the same pret repo was. `unconfirmed` means none was.",
          "",
          ...lines,
        ]
      : ["Every shipped profile's signature was checked on the owner's ROM."]),
    "",
  ].join("\n");
}
