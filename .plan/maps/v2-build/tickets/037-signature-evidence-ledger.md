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
