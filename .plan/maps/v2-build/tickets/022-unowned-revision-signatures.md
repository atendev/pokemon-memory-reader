---
type: grilling
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794792924
claimed_at: 2026-11-16T03:56:33Z
---

# What happens to signatures for revisions the owner doesn't own?

## Question

Spec §17 item 10. `test:local` must confirm each official Gen 3 signature against the owner's retail ROM. Decide what happens to revisions the owner doesn't own: ship them unverified, or hold them back.

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

[The amendment](../assets/022-unowned-revision-signatures.md) settles it, decided in auto mode on 2026-11-16. [Decision report](../assets/022-unowned-revision-signatures-report.md).

- Official Gen 3 revisions the owner doesn't own ship in v2.0 with their generated signature.
- Each profile that declares signature words gets `provenance.signatureEvidence`. `owner` means a `test:local` check passed on a retail ROM with the No-Intro SHA-1. `chain` means the pret SHA-1 equals No-Intro's and another revision from the same pret repo is `owner`. `unconfirmed` means the SHA-1s match but nothing from that repo has been checked. A committed ledger, which `test:local --record` appends to, is the source.
- A broken chain on an unowned revision (today only Sapphire German 1.0) is held back by the generator's skip list. It re-enters through an owner check plus its smoke fixture, or once pret's SHA-1 matches No-Intro's.
- A failed owner check blocks every profile from that pret repo until the generator is fixed. An owned broken-chain revision is the exception.
- Nothing changes at runtime or in the API. A default-suite test gates the RC and `v2.0.0` on the levels, the skip list and the release notes list.
- Ruby/Sapphire headers have no species, item or move pointers, so their signature words go to a new ticket. Until then their profiles declare no signature.

Why: a wrong signature costs a log line, or a manual pick on emulators that give no hash. pret builds that match retail SHA-1s describe retail bytes, and the field mapping is shared per repo. Excluded: holding back unowned revisions, shipping them with no signature, a runtime log or API field for the level, repair by written diff, and hack profile signatures.
