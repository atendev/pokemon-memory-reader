---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795285581
claimed_at: 2026-11-21T18:27:28Z
---

# Gen 3 item names per profile

## What to build

[FireRed and LeafGreen profiles](./077-firered-leafgreen-profiles.md) surfaced this: Gen 3 item names come from one shared reference table, but item IDs and names differ between the Emerald, FireRed and LeafGreen games. Read the 077 report for the exact gap, then key item names per profile (by data format and art version, as the location names are in [034](./034-gen3-location-names.md)) so each game's bag and party show its own names.

## Acceptance criteria

- Item names resolve per profile, and a name that exists in only one game doesn't leak into another.
- The generator output is stable on a second run, and the `scripts/` tests cover it.
- No ROM bytes are committed.
