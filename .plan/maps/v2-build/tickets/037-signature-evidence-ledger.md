---
type: task
blocked_by: [029]
claimed_by: wayfinder-master v2-build-master-1794807670
claimed_at: 2026-11-16T06:00:30Z
---

# Signature evidence ledger, generator field and release gate

## Question

Build what [What happens to signatures for revisions the owner doesn't own?](./022-unowned-revision-signatures.md) decided, per [its amendment](../assets/022-unowned-revision-signatures.md): the ledger that `test:local --record` writes, the generator writing `provenance.signatureEvidence` (`owner`, `chain` or `unconfirmed`) from that ledger and the hash lists from [Generate hash lists from pret and No-Intro](./029-generate-hash-lists.md), the generator holding back Sapphire German 1.0, and the CI test that gates the release candidate on these ratings. Nothing changes at runtime or in the API.

## Acceptance

- Generator tests on checked-in excerpts produce each of the three ratings and hold back a revision with a broken chain.
- The CI gate test fails when a shipped profile lacks a rating the amendment requires.
- No ROM bytes are committed.

## Note from 029

`generate:profiles` now stops the whole run when a pret SHA-1 has no matching No-Intro entry. [Where does reference data come from?](./019-reference-data-source.md) says a disagreement leaves that revision without hashes instead. Holding back Sapphire German 1.0 needs a hold-back path that skips the revision rather than failing the run.

## Answer

Built per [the 022 amendment](../assets/022-unowned-revision-signatures.md). `generate:profiles` reads a committed ledger (`scripts/generate-profiles/signature-ledger.json`, starts empty) and writes `provenance.signatureEvidence` (`owner`, `chain` or `unconfirmed`) on each official profile with signature words. Emerald is `unconfirmed`. `recordSignatureCheck` is the one function `test:local --record` will call, because `test:local` doesn't exist yet.

The hold-back path from the 029 note is a `heldBack` list in `definitions.ts`. Sapphire German 1.0 is on it. The generator prints why, writes no profile, and the run succeeds. Removing the entry is the one-line re-entry. A built revision with a broken chain still fails the run.

The release gate is `release-gate.test.ts`, which runs in the default suite with no ROMs. It checks every shipped official profile's rating against the ledger and SHA-1 data, that each official built-in has a CRC32 beside every SHA-1, that no held-back revision is built in, and that the generated `SIGNATURE-EVIDENCE.md` lists every non-owner profile. Negative cases show it fails. The generator logic is a pure `planGeneration`, tested on checked-in excerpts. No ROM bytes are committed.

Excluded: building `test:local` itself, the owner re-entry route for Sapphire German (it needs a full definition after ticket 036), and wiring the notes file into the draft release body.

Report: [037 report](../assets/037-signature-evidence-ledger-report.md). Audit: APPROVE in round 2. CI green on PR 19.
