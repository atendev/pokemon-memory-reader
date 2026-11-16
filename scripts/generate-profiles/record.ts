import { readFile, writeFile } from "node:fs/promises";
import { appendLedgerEntry, parseLedger, renderLedger } from "./evidence";

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
