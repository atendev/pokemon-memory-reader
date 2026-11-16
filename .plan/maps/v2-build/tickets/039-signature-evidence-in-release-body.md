---
type: task
blocked_by: [037]
claimed_by: wayfinder-master v2-build-master-1794807670
claimed_at: 2026-11-16T06:19:17Z
---

# Put `SIGNATURE-EVIDENCE.md` into the draft release body

## Question

[Signature evidence ledger, generator field and release gate](./037-signature-evidence-ledger.md) makes `generate:profiles` write `SIGNATURE-EVIDENCE.md`. The release workflow should add it to the draft release body, per [the 022 amendment](../assets/022-unowned-revision-signatures.md), within the release checks that [How do prereleases ship while main stays untouched?](./024-prereleases-without-main.md) set.

## Acceptance

- The release workflow's body step includes `SIGNATURE-EVIDENCE.md`, tested by a script-level test that needs no GitHub call.
- A missing file fails the step with a clear message.

## Answer

`scripts/release-body.ts <body-file> [evidence-file]` is the release body step. It appends `server/src/profile/builtin/SIGNATURE-EVIDENCE.md` to the body file that `release.yml` will pass to `gh release create --notes-file`. It reads the notes before touching the body, so a failure leaves the body as it was.

A missing file fails with `SIGNATURE-EVIDENCE.md is missing at <path>` and the `bun run generate:profiles` fix, exit 1. An empty, heading-only or wrongly headed file fails too, and so does a body that already has the section. `scripts/release-body.test.ts` runs 11 tests in the default suite with no GitHub call.

`release.yml` and `check-release-ref.ts` don't exist yet, so the call in the workflow, after the ref check, waits for the workflow ticket under the map's beta.1 fog.

Excluded: writing a whole `release.yml` for one step, and atomic writes to the body file (CI writes a scratch file).

Report: [039 report](../assets/039-signature-evidence-in-release-body-report.md). Audit: APPROVE in round 2. CI green on PR 22.
