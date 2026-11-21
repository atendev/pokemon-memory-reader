---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795285581
claimed_at: 2026-11-21T18:27:28Z
---

# Regenerate the installed `mgba.lua` when the mGBA endpoint changes live

## What to build

Surfaced by [Apply live `adapters` endpoint changes](./106-apply-live-adapter-endpoint-changes.md). The mGBA bridge script served to the emulator embeds the host and port. When the endpoint changes live, the script the owner installed or loaded goes stale. Make the program serve a regenerated script for the new endpoint and tell the viewer when the loaded script no longer matches.

## Acceptance criteria

- A live endpoint change makes the served `mgba.lua` carry the new host and port.
- The viewer or `/adapters` says when the emulator's loaded script is stale.
- Tests cover a changed and an unchanged endpoint.

## Answer

Built. A live `adapters` change regenerates the mGBA bridge with the current endpoint, swaps the copy `/bridges/mgba.lua` serves (the route now reads a getter per request) and rewrites the installed file. `/adapters` reports `scriptStale` per adapter: true when the script that last connected, or the startup install, was made for a different endpoint than the one now in use. A bridge hello moves that baseline, so no wire change was needed, and a change back to the old endpoint is not stale. The Settings and Connection screens show a note. An unchanged endpoint touches nothing. A host a script cannot carry (a name or a wildcard) logs a warning and keeps the old script, which is surfaced as a follow-up. [Report](../assets/117-regenerate-mgba-lua-on-endpoint-change-report.md).

Timing: wall 6m, active 6m, user 0s, wait 0s, blocked 0s | implement 2m, audit 2m (2 rounds), gate 50s | tools 46 (8 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 124k | cost $1.44 sonnet-5-5 + $0.03 haiku-5-5
