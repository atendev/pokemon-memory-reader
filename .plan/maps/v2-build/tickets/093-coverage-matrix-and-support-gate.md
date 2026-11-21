---
type: task
blocked_by: [091]
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T15:30:00Z
---

# Coverage matrix, guard and the `supported` flag

## What to build

Spec §12.7 and §12.8, and the `supported` flag the tracer left out ([009](./009-tracer-api.md), decision 5). Add `supported` to the game binding, build the coverage matrix and the guard that refuses a resource its fixtures don't cover, and report it through `status` and the 503 `unsupported` code from [the 020 amendment](../assets/020-status-and-error-details.md). A data format with no verified fixtures ships with `supported: false`.

## Acceptance criteria

- Tests cover a supported game, an unsupported game and a resource the fixtures don't cover.
- `status.game` and the 503 codes match 020, and the viewer's `unsupported` state works through the connection screen.
- The matrix is generated, not hand-edited, and a CI test fails when it is stale.

## Answer

`SUPPORTED` in `server/src/format/support.ts` holds one flag per data format, and all four ship `false` because no tier 1 fixture is verified yet. `bindGame` returns `{ supported: false }` for such a format, and the read loop answers 503 `unsupported` on every resource, ahead of `no_data`, with `status.state` still `game` and `status.game` populated. The viewer's connection screen already shows its `unsupported` state from that code. The matrix in `server/test/fixtures/coverage.ts` and the guard in `server/test/support/coverage-guard.ts` fail the suite when a format is flagged supported without every tier 1 state verified on each primary revision. `bun run coverage` generates `docs/coverage.md`, and a default-suite test fails when it is stale. `PMR_ASSUME_SUPPORTED=<formats>` serves an unsupported format for decoder work and the executable test. Capturing the tier 1 fixtures and lifting the flags is surfaced as a ticket. Audit: Claude seat only, approved at round 2 with a score of 8 (Gemini and GPT: not run). [Report](../assets/093-coverage-matrix-and-support-gate-report.md).

Timing: wall 8m, active 8m, user 0s, wait 0s, blocked 0s | implement 6m, audit 1m (2 rounds) | tools 73 (8 subagent) | limits 0, compactions 0, handoffs 1 | ctx peak 143k | cost $2.46 sonnet-5-5 + $0.02 haiku-5-5
