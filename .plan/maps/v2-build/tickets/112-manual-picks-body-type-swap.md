---
type: task
blocked_by: [108]
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T14:40:00Z
---

# Swap the local `ManualPicksBody` mirror for the type `internal/` exports

## What to build

Surfaced by [Viewer Settings and About screens](./085-viewer-settings-and-about.md). The Settings pick control reads a local mirror of the manual picks body and falls back on a 404. Once [the candidates list](./108-manual-picks-candidates-list.md) exports its type from `internal/`, import it, delete the mirror and drop the 404 fallback.

## Acceptance criteria

- The viewer imports the body type from `internal/` and has no local copy.
- The pick control lists candidates in the compiled-executable test.
- The 404 fallback and its test are removed.
