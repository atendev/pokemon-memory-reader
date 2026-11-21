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

## Answer

Gen 3 item names now resolve per art version. `names.items` in `gen3-en.json` is one table per art version (`ruby-sapphire` 349 IDs, `emerald` 377, `firered-leafgreen` 375), built by the reference generator from each pinned pret repo. `referenceData("gen3", "en").items(artVersion)` feeds `bindGame`, so bag rows, held items, balls, Trainer items and battle held items use the profile's own table. [Report](../assets/101-gen3-item-names-per-profile-report.md).

- The pinned repos agree on every shared item ID. The fault was a leak from the merged table: Emerald's 375 and 376 named IDs FireRed and LeafGreen lack, and FireRed's key items at 349 to 374 named IDs Ruby and Sapphire lack. Now each game gives `null` for IDs it does not have.
- Each repo keeps its own table and the generator fails on a missing or doubled source. `LocationKey` became `ArtKey` and the location and item tables share one helper.
- The icon-map generator takes the same per-art-version names. `icon-maps.json` loses Ruby and Sapphire 349 to 376 and FireRed and LeafGreen 375 and 376. The ticket 105 equality test is now a subset test.
- The generator output is the same on a second run (same SHA-1 after Biome format), a test builds twice and compares, and no ROM bytes are committed.
- Excluded: keying by profile ID, which would copy one table across the four FireRed and LeafGreen profiles, and keeping one merged array for icons.

Timing: wall 6m, active 6m, user 0s, wait 0s, blocked 0s | implement 4m, audit 1m (2 rounds) | tools 59 (7 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 120k | cost $1.66 sonnet-5-5 + $0.01 haiku-5-5
