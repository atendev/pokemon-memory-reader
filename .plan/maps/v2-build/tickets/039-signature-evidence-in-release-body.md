---
type: task
blocked_by: [037]
---

# Put `SIGNATURE-EVIDENCE.md` into the draft release body

## Question

[Signature evidence ledger, generator field and release gate](./037-signature-evidence-ledger.md) makes `generate:profiles` write `SIGNATURE-EVIDENCE.md`. The release workflow should add it to the draft release body, per [the 022 amendment](../assets/022-unowned-revision-signatures.md), within the release checks that [How do prereleases ship while main stays untouched?](./024-prereleases-without-main.md) set.

## Acceptance

- The release workflow's body step includes `SIGNATURE-EVIDENCE.md`, tested by a script-level test that needs no GitHub call.
- A missing file fails the step with a clear message.
