---
type: task
blocked_by: [037]
---

# Build `test:local` with its signature check and `--record` call

## Question

[Signature evidence ledger, generator field and release gate](./037-signature-evidence-ledger.md) built the ledger and `recordSignatureCheck`, but `test:local` doesn't exist yet. Build it per [the 022 amendment](../assets/022-unowned-revision-signatures.md): it runs against ROMs on the owner's machine, checks each owned revision's signature, and with `--record` writes the result to the ledger through `recordSignatureCheck`. A failed owner check blocks that repo's profiles.

## Acceptance

- Tests drive `test:local` against synthetic ROM-shaped buffers, never a real ROM, and cover pass, fail and `--record`.
- `--record` updates only the ledger, and a second run with the same inputs gives no diff.
- No ROM bytes are committed.
