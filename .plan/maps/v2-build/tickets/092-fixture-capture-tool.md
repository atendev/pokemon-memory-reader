---
type: task
blocked_by: [091]
---

# Fixture capture tool

## What to build

HITL for its real run, because it needs the owner's emulator and ROM. Spec §12.4. Build the capture tool that records live-memory slices into the fixture format from a running adapter, then run it with the owner on an Emerald US 1.0 party and write the first real fixture. Don't capture or commit ROM bytes. Ask the owner when the emulator and ROM are free.

## Acceptance criteria

- The tool is covered by tests against the fake bridge.
- The owner confirms the first real fixture decodes to the party they saw in the game.
- No ROM bytes are in the repo, and the fixture passes the rejection test from the fixture ticket.
