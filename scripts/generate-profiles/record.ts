import { readFile, writeFile } from "node:fs/promises";
import {
  appendFailure,
  appendLedgerEntry,
  clearFailures,
  parseFailures,
  parseLedger,
  renderFailures,
  renderLedger,
} from "./evidence";

/** Appends one passing signature check to the ledger file. `test:local --record` calls this and nothing else writes the ledger. */
export async function recordSignatureCheck(
  ledgerPath: string,
  check: { profileId: string; sha1: string },
  now: Date = new Date(),
): Promise<void> {
  const entries = parseLedger(await readFile(ledgerPath, "utf8"));
  const next = appendLedgerEntry(entries, {
    profileId: check.profileId,
    sha1: check.sha1.toLowerCase(),
    date: now.toISOString().slice(0, 10),
  });
  await writeFile(ledgerPath, renderLedger(next));
}

/** Writes one failed owner check to the failure record. The ledger stays append-only and never sees it. */
export async function recordSignatureFailure(
  failuresPath: string,
  check: { profileId: string; repo: string; sha1: string },
  now: Date = new Date(),
): Promise<void> {
  const entries = parseFailures(await readFile(failuresPath, "utf8"));
  const next = appendFailure(entries, {
    profileId: check.profileId,
    repo: check.repo,
    sha1: check.sha1.toLowerCase(),
    date: now.toISOString().slice(0, 10),
  });
  await writeFile(failuresPath, renderFailures(next));
}

/** Drops the failures a later pass for the same profile and ROM resolves. Leaves the file untouched when there are none. */
export async function clearSignatureFailure(
  failuresPath: string,
  pass: { profileId: string; sha1: string },
): Promise<void> {
  const entries = parseFailures(await readFile(failuresPath, "utf8"));
  const next = clearFailures(entries, {
    profileId: pass.profileId,
    sha1: pass.sha1.toLowerCase(),
  });
  if (next.length !== entries.length)
    await writeFile(failuresPath, renderFailures(next));
}
