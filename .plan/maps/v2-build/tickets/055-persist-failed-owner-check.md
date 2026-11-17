---
type: task
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794843940
claimed_at: 2026-11-16T16:21:08Z
---

# Persist a failed owner check so the release gate blocks the repo

## Question

[The 022 amendment](../assets/022-unowned-revision-signatures.md) says a failed owner check blocks that repo's profiles. [Build `test:local` with its signature check and `--record` call](./038-test-local-signature-record.md) blocks them for its own run only: the ledger holds passes, and the release gate from [ticket 037](./037-signature-evidence-ledger.md) reads no failure state. Add a persisted failure record that `test:local --record` writes, and a release-gate rule that blocks every profile of a repo with an unresolved owner failure. Keep passes append-only. See [the 038 report](../assets/038-test-local-signature-record-report.md), decision 5.

## Acceptance

- A failed owner check under `--record` writes a failure record, and `release-gate.test.ts` then fails for that repo's profiles.
- A later pass for the same profile and SHA-1 clears the block, and a second identical run gives no diff.
- Tests use synthetic ROM-shaped buffers. No ROM bytes are committed.

## Answer

`test:local --record` writes a failure row `{ profileId, repo, sha1, date }` to the new committed file `scripts/generate-profiles/signature-failures.json` when a ROM the profile lists misses its signature words. A later pass for the same profile and ROM removes the row, and repeat runs of either kind give no diff. `releaseGateProblems` takes the failures as a required argument and blocks every shipped profile of a repo with an open row, signed or not. A repo-less failure blocks only its own profile. The ledger stays append-only.

A wrong or unreadable file still fails the run and blocks the run's own repo as in ticket 038, but writes no row, because no pass could ever name that ROM's SHA-1. A pass clears its own row even when a sibling in the repo fails in the same run.

Audit APPROVE in round 3 (gemini 10, gpt 9, claude 8). CI green on [PR 37](https://github.com/atendev/pokemon-memory-reader/pull/37). See [the decision report](../assets/055-persist-failed-owner-check-report.md).
