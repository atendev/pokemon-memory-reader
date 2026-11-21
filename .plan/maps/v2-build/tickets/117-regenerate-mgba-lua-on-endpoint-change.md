---
type: task
blocked_by: []
---

# Regenerate the installed `mgba.lua` when the mGBA endpoint changes live

## What to build

Surfaced by [Apply live `adapters` endpoint changes](./106-apply-live-adapter-endpoint-changes.md). The mGBA bridge script served to the emulator embeds the host and port. When the endpoint changes live, the script the owner installed or loaded goes stale. Make the program serve a regenerated script for the new endpoint and tell the viewer when the loaded script no longer matches.

## Acceptance criteria

- A live endpoint change makes the served `mgba.lua` carry the new host and port.
- The viewer or `/adapters` says when the emulator's loaded script is stale.
- Tests cover a changed and an unchanged endpoint.
