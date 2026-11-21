---
type: task
blocked_by: [093]
---

# Paste the coverage guard's lists into the draft release body

## What to build

Surfaced by [`release.yml` and per-OS archives](./089-release-workflow.md). The draft release body should include the coverage guard's tier 2 and no-fixture list from [the coverage matrix and support gate](./093-coverage-matrix-and-support-gate.md), once the guard exists. Extend `scripts/release-body.ts` and the `draft` job in `release.yml`.

## Acceptance criteria

- The body lists tier 2 games and games with no fixtures, taken from the guard's output.
- A missing or damaged guard output fails the step with a clear message, tested without GitHub.
