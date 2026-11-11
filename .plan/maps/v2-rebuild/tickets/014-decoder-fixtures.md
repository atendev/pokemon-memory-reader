---
type: grilling
blocked_by: []
assets: []
---

# Decoder test fixtures

## Question

How do decoders get tested against real game data without committing ROMs?

The owner can produce savestates and RAM dumps, and the [License](./007-license.md) decision allows only trimmed RAM slices in the repo. Decide the slice file format, which game states to capture per data format (party, bag, battle, boxes, edge cases), the tool that cuts a slice from a local dump, and how tests run without the local dumps.
