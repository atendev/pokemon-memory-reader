---
type: task
blocked_by: []
---

# Tell the owner when the mGBA endpoint can't be written into a script

## What to build

Surfaced by [Regenerate the installed `mgba.lua` when the mGBA endpoint changes live](./117-regenerate-mgba-lua-on-endpoint-change.md). `buildBridge` rejects a host name or a wildcard host. When a live `adapters` change sets one, the old script stays served and the server only logs a warning, while the stale note still says "Load mgba.lua again", which would load the same script. Report the rejection to the owner through `/adapters` and the viewer, and stop the stale note from asking for a reload that changes nothing.

## Acceptance criteria

- A host the script can't carry shows a clear note on `/adapters` and in the viewer, naming the host and the reason.
- The stale note no longer says to load the script again in that case.
- Tests cover a host name, a wildcard host and a valid address.
