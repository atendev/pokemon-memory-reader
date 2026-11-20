---
type: task
blocked_by: [091]
---

# Coverage matrix, guard and the `supported` flag

## What to build

Spec §12.7 and §12.8, and the `supported` flag the tracer left out ([009](./009-tracer-api.md), decision 5). Add `supported` to the game binding, build the coverage matrix and the guard that refuses a resource its fixtures don't cover, and report it through `status` and the 503 `unsupported` code from [the 020 amendment](../assets/020-status-and-error-details.md). A data format with no verified fixtures ships with `supported: false`.

## Acceptance criteria

- Tests cover a supported game, an unsupported game and a resource the fixtures don't cover.
- `status.game` and the 503 codes match 020, and the viewer's `unsupported` state works through the connection screen.
- The matrix is generated, not hand-edited, and a CI test fails when it is stale.
