---
type: task
blocked_by: []
---

# Capture tier 1 fixtures and lift the `supported` flags

## What to build

HITL. Surfaced by [Coverage matrix and support gate](./093-coverage-matrix-and-support-gate.md). Every data format ships `supported: false` until it has verified fixtures. Once [the capture tool](./092-fixture-capture-tool.md) exists and the owner has ROMs and an emulator, capture tier 1 fixtures for each format, check them against the game's screens, and set `supported: true` per format. Never commit a ROM or ROM bytes. This waits until the owner says ROMs and an emulator are available.

## Acceptance criteria

- Each lifted format has verified fixtures and goldens, and `docs/coverage.md` regenerates with the new flag.
- The report records the ROM revisions used, not their bytes.
- A format without verified fixtures stays `supported: false`.
