---
type: task
blocked_by: []
---

# Persist a failed owner check so the release gate blocks the repo

## Question

[The 022 amendment](../assets/022-unowned-revision-signatures.md) says a failed owner check blocks that repo's profiles. [Build `test:local` with its signature check and `--record` call](./038-test-local-signature-record.md) blocks them for its own run only: the ledger holds passes, and the release gate from [ticket 037](./037-signature-evidence-ledger.md) reads no failure state. Add a persisted failure record that `test:local --record` writes, and a release-gate rule that blocks every profile of a repo with an unresolved owner failure. Keep passes append-only. See [the 038 report](../assets/038-test-local-signature-record-report.md), decision 5.

## Acceptance

- A failed owner check under `--record` writes a failure record, and `release-gate.test.ts` then fails for that repo's profiles.
- A later pass for the same profile and SHA-1 clears the block, and a second identical run gives no diff.
- Tests use synthetic ROM-shaped buffers. No ROM bytes are committed.
