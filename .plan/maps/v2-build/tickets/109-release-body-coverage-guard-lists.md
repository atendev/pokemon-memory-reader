---
type: task
blocked_by: [093]
claimed_by: wfm-v2-build-master-1795285581
claimed_at: 2026-11-21T18:37:00Z
---

# Paste the coverage guard's lists into the draft release body

## What to build

Surfaced by [`release.yml` and per-OS archives](./089-release-workflow.md). The draft release body should include the coverage guard's tier 2 and no-fixture list from [the coverage matrix and support gate](./093-coverage-matrix-and-support-gate.md), once the guard exists. Extend `scripts/release-body.ts` and the `draft` job in `release.yml`.

## Acceptance criteria

- The body lists tier 2 games and games with no fixtures, taken from the guard's output.
- A missing or damaged guard output fails the step with a clear message, tested without GitHub.

## Answer

`scripts/release-body.ts` appends a `### Fixture coverage` section with the tier 2 gaps and the no-fixture profiles, read from the guard's committed output `docs/coverage.md`. The guard exports the two heading names, so the page renderer and the reader can't drift. A missing file, a file that isn't the page, a missing or empty section, or a section that isn't `None.` or a bullet list fails with a message that names the path or section and says to run `bun run coverage`. The step reads both inputs before it writes, so a failure leaves the body untouched, and a second run fails. The `draft` job runs `bun scripts/coverage.ts --check` first, so the lists match the repo. All of it is tested without GitHub. Audit: Claude seat only, approved at round 1 with a score of 8 (Gemini and GPT: not run), four minor problems declined. [Report](../assets/109-release-body-coverage-guard-lists-report.md).

Timing: wall 3m, active 3m, user 0s, wait 0s, blocked 0s | implement 1m, audit 54s (1 round) | tools 20 (2 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 99k | cost $0.81 sonnet-5-5 + $0.01 haiku-5-5
