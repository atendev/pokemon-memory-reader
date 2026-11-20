---
type: task
blocked_by: [072, 073]
---

# Manual ROM picks

## What to build

Spec §9.6 with [the 014 amendment](../assets/014-rom-keying-and-reidentification.md) and [the 021 amendment](../assets/021-viewer-control-routes.md). Picks are stored in the data folder and keyed by any emulator hash (SHA-1, else CRC32), else a header key tagged with the platform, plus RetroArch's content name when it has no hash. The opt-in `base:<profileId>` pick covers randomizer seeds. The server sets the key. The internal `/manual-picks` route is pick and forget, behind the shared write guard from 021.

## Acceptance criteria

- Tests cover each key kind, a `base:<profileId>` pick, forgetting a pick and a pick surviving a restart.
- The route-table test from 021 covers `/manual-picks`, and a write without the guard is refused.
- A picked game identifies with the pick shown in `status`.
