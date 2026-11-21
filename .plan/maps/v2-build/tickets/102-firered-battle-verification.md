---
type: task
blocked_by: []
---

# FireRed battle verification on a real game

## What to build

HITL. [FireRed and LeafGreen profiles](./077-firered-leafgreen-profiles.md) builds the FireRed `battle` block from pokefirered symbols with no ROM to check it. When the owner has a FireRed ROM and an emulator, run a real battle against the tracer and compare the `battle` resource with the game's own screens. This waits until the owner says a ROM and emulator are available. Never commit a ROM or ROM bytes.

## Acceptance criteria

- A wild and a trainer battle match the game on species, HP, moves and outcome.
- Any wrong symbol or offset found is fixed in the generator definition and regenerated.
- The report records the ROM revision used, not its bytes.
