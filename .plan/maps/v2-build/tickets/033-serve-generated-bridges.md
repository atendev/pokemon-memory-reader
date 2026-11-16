---
type: task
blocked_by: [007, 031]
---

# Serve generated bridges at startup and at `/bridges/<name>.lua`

## Question

[mGBA bridge and adapter](./007-mgba-bridge-and-adapter.md) built `buildBridge`, which writes the configured host and port into a bridge script, but nothing calls it yet. Wire it into server startup after [Load built-in profiles at server startup](./031-load-builtin-profiles-at-startup.md), and serve each generated bridge at `/bridges/<name>.lua`. Follow the bridge and config sections of the spec.

## Acceptance

- Starting the server generates the mGBA bridge with the configured host and port, shown by a test.
- `GET /bridges/mgba.lua` returns that script, and an unknown name returns the spec's error body.
