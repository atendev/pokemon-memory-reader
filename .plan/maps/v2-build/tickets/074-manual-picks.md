---
type: task
blocked_by: [072, 073]
claimed_by: wfm-v2-build-master-1795260524
claimed_at: 2026-11-21T12:31:46Z
---

# Manual ROM picks

## What to build

Spec §9.6 with [the 014 amendment](../assets/014-rom-keying-and-reidentification.md) and [the 021 amendment](../assets/021-viewer-control-routes.md). Picks are stored in the data folder and keyed by any emulator hash (SHA-1, else CRC32), else a header key tagged with the platform, plus RetroArch's content name when it has no hash. The opt-in `base:<profileId>` pick covers randomizer seeds. The server sets the key. The internal `/manual-picks` route is pick and forget, behind the shared write guard from 021.

## Acceptance criteria

- Tests cover each key kind, a `base:<profileId>` pick, forgetting a pick and a pick surviving a restart.
- The route-table test from 021 covers `/manual-picks`, and a write without the guard is refused.
- A picked game identifies with the pick shown in `status`.

## Resolution

Manual picks are built. `romKeys` derives the key from the loaded ROM (SHA-1 then CRC32, else a platform-tagged header key that ends in RetroArch's content name, else `name:<platform>:<name>`), and `base:<profileId>` covers modified ROMs of a base game that pass the 014 conditions. `openPickStore` keeps `<data folder>/manual-picks.json` (Zod, re-read and merge, atomic rename, `.bad` quarantine) with a per-key overlay, so a pick whose write failed or that has no key still applies for the session. `identification` looks a pick up only after automatic identification leaves the ROM unidentified, and the pick shows as `match: "manual"` in `status`. `POST /manual-picks` and `POST /manual-picks/forget` sit behind the write guard, with the route-table rows and a refusal test. Not built: `GET /manual-picks` (needs a signature read per candidate) and `expansion_rom` (no RHHEXP scan yet). One Claude council seat approved in round 3 of 5 (8). [Decision report](../assets/074-manual-picks-report.md).

Timing: wall 14m, active 14m, user 0s, wait 0s, blocked 0s | implement 8m, audit 5m (3 rounds) | tools 104 (8 subagent) | limits 0, compactions 0, handoffs 1 | ctx peak 137k | cost $3.49 sonnet-5-5 + $0.03 haiku-5-5
