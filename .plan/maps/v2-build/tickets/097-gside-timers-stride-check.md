---
type: task
blocked_by: [092]
---

# Check the `gSideTimers` stride against a real Emerald ROM

## What to build

[Gen 3 battle decoders](./068-gen3-battle-decoders.md) read `gSideTimers` with a 12-byte stride, taken from the 0x18 symbol size for two sides. pret master lists 11 members, so the stride is unconfirmed, and opponent spikes depends on it. Confirm it with a fixture captured by [the fixture capture tool](./092-fixture-capture-tool.md) from a real Emerald battle with spikes set on the opponent's side, then fix the decoder if the stride is wrong.

This needs the owner's Emerald ROM and an emulator, so it waits until the owner says they are available.

## Acceptance criteria

- A fixture from a real Emerald battle shows the opponent's spikes layers decoding to the in-game value.
- The stride is pinned by a test, and no ROM bytes are committed.
