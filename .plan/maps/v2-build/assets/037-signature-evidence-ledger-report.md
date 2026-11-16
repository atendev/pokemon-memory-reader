# Signature evidence ledger, generator field and release gate: decision report

Ticket: [Signature evidence ledger, generator field and release gate](../tickets/037-signature-evidence-ledger.md). Built on branch `t3/signature-evidence-ledger-gate`. Audit: APPROVE in round 2 (haiku auditor). Round 1 raised three problems (a circular notes check, a narrow chain check, an untested generator path), and all three are fixed.

## Decisions

1. **Where the ledger lives and who writes it.**
   - Question: `test:local --record` writes the ledger, but `test:local` doesn't exist yet. What does this ticket build?
   - Options: build all of `test:local`, or build the ledger and the one function `--record` will call.
   - Choice: the ledger file `scripts/generate-profiles/signature-ledger.json` (committed, starts as `[]`), a strict parser, and `recordSignatureCheck` in `record.ts`. It appends `{ profileId, sha1, date }` with a lowercase hash and the UTC date, and keeps the first entry for a repeated profile and ROM. `test:local` itself needs the owner's ROMs and belongs to the fixture-capture work already in the map's fog.
   - Made by: main thread. Audit: approved.

2. **How a level is computed.**
   - `rateSignatureEvidence` follows amendment 022 item 2 exactly. `owner` needs a ledger entry whose SHA-1 is in the profile's `identify.sha1`. `chain` needs another shipped revision from the same pret repo at `owner`. Everything else is `unconfirmed`.
   - A ledger entry for a shipped profile with a SHA-1 outside its `identify.sha1` is reported by `ledgerProblems`. The generator throws on it and the gate lists it, so a typo can't quietly downgrade an owned profile.
   - Made by: main thread, following the amendment.

3. **Broken chains and the hold-back path.** It answers the note from 029.
   - A new `heldBack` list in `definitions.ts` holds Sapphire German 1.0 with the pinned pokeruby `sapphire_de.sha1` and DAT, plus a reason. The generator fetches both for each entry, prints why the revision is held back, and never fails the run and never writes a profile. If the chain is intact, it prints that the hold-back is stale. Taking the entry out of `heldBack` is the one-line re-entry.
   - `resolveHashes` still throws for a definition that isn't held back, and its message now names `heldBack` as the way out. Held-back entries have no symbols or addresses, because no profile is built from them.
   - The owner re-entry route (listing the No-Intro SHA-1 in `identify.sha1`) needs a full Sapphire German definition. That waits on [Ruby/Sapphire signature bytes](../tickets/036-ruby-sapphire-signature-bytes.md), so I did not build it.
   - Made by: main thread. Audit: approved.

4. **Schema and the Emerald profile.** `provenance` for `pret` gains an optional `signatureEvidence` enum. The generator always writes it for the official profiles it builds, so Emerald now carries `unconfirmed` (empty ledger, one revision). A running server reads the field and does nothing with it. The API is unchanged.

5. **The release gate.** `releaseGateProblems` in `gate.ts` returns every reason not to ship, and `release-gate.test.ts` asserts it returns none for the built-in profiles. The same test file feeds it a profile with no rating, a wrong rating, a stale ledger entry, a held-back ID in the built-in set, a missing CRC32 (on a signed profile and on an official one with no signature words) and release notes that omit a profile. Each case fails with its own message.
   - Chain intactness can't be rechecked offline without the DAT, so the gate checks that each official built-in has a CRC32 beside every SHA-1. The generator only writes a CRC32 from a matching No-Intro entry. The check covers every official built-in, not only the signed ones.
   - Release notes: `generate:profiles` writes `server/src/profile/builtin/SIGNATURE-EVIDENCE.md`, the section listing every non-owner profile with its level. The gate reads that committed file, and a test checks that it equals what the generator writes for the committed ledger. In the first draft the gate rendered the notes itself, so it could never fail. The auditor caught that in round 1. Wiring the file into the draft release body belongs to the release workflow ticket.
   - Made by: main thread, with the auditor's round-1 objections applied. Audit: approved in round 2.

6. **Generator split.** `main.ts` now only fetches and writes. `planGeneration` in `plan.ts` is a pure function of the fetched data and the ledger. It holds back each `heldBack` entry (message, no file), builds the rest, fails on a broken chain or a stale ledger entry, and returns the profile files, `index.ts` and the notes file. `plan.test.ts` runs it on the checked-in excerpts and checks Emerald at `owner` and `unconfirmed`, a second revision at `chain`, and Sapphire German 1.0 held back. The auditor asked for this split in round 1. Audit: approved in round 2.

7. **Fixtures.** `fixtures/pokeruby.sapphire_de.sha1` is pret's file at the pinned commit. The DAT excerpt gains the real "Saphir-Edition (Germany)" entry from the pinned DAT (a hash line, no ROM bytes). Only Emerald has a definition so far. `plan.test.ts` rates a second revision with a real No-Intro SHA-1 from the excerpt (the Spanish Sapphire Rev 1 entry, standing in for a sibling revision). `evidence.test.ts` covers the rating rules on synthetic inputs.

## Evidence

- `bun run generate:profiles` ran against the network. It printed the hold-back line for `sapphire-de-1.0` and rewrote Emerald with only `"signatureEvidence": "unconfirmed"` added.
- `bun test scripts server/src/profile` passes (97 tests), and `biome ci` and `tsc` pass. The full `bun test` has one failure, `the Lua core runs under Lua 5.3 or 5.4`. This machine has Lua 5.5 and CI uses 5.4. It does not involve this change.
- No ROM bytes are committed.

## Skipped

- I did not rename the thread.
