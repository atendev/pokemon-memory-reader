---
type: task
blocked_by: []
---

# Ruby and Sapphire battle verification on a real game

## What to build

HITL. [Ruby and Sapphire profiles](./078-ruby-sapphire-profiles.md) builds the `battle` block and the `constants` layout values (in-battle byte at `gMain+0x43D`, spikes offset, money multiplier, 4-byte money entries) from pokeruby symbols with no ROM to check them. When the owner has a Ruby or Sapphire ROM and an emulator, run a real wild and trainer battle against the tracer and compare the `battle` resource with the game's screens. This waits until the owner says a ROM and emulator are available. Never commit a ROM or ROM bytes.

## Acceptance criteria

- A wild and a trainer battle match the game on species, HP, moves, outcome and prize money.
- Any wrong symbol or constant is fixed in the generator definition and regenerated.
- The report records the ROM revision used, not its bytes.
