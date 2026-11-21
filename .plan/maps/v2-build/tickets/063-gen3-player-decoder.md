---
type: task
blocked_by: [062]
claimed_by: wfm-v2-build-master-1795256075
claimed_at: 2026-11-21T10:45:51Z
---

# Gen 3 player decoder and `player` resource

## What to build

Build the `player` resource for the Gen 3 data format on Emerald, following spec §7.6 and [the 017 amendment](../assets/017-player-and-bag-shapes.md): `{ name, trainerId, secretId | null, money, badges, location, playTime }`. Per-game values live in a profile `player` block, and `generate:profiles` writes the Emerald addresses from the pinned pret symbols.

Emerald stores money (and, in the bag ticket, item quantities) XORed with the save encryption key in `gSaveBlock2`. Confirm the exact fields and the badge flag ids in pokeemerald before coding. `location.section` and the other location fields follow the 017 amendment and the location tables from [Gen 3 location names reference data](./034-gen3-location-names.md). `GET /api/v2/player` joins the app, the `player` topic joins the topic list, and the API schemas follow the sync rules from [Zod-free declarations](./057-zod-free-api-declarations-build.md): a type, a sync pair and a `PAIRED` entry.

## Acceptance criteria

- `GET /api/v2/player` returns a `Player` that parses with the real schema on synthetic Emerald memory, with money decrypted and eight badges.
- The decoder tests cover a moved `gSaveBlock1Ptr` and a null pointer (a 503 `no_data` through the existing codes).
- The Emerald profile gains its `player` block from the generator, and the profile is regenerated with a stable second run.
- Type, schema and sync tests are in place. No ROM bytes are committed.

## Answer

Built the Gen 3 `player` resource for Emerald. `gen3Player` reads the name, trainer and secret IDs, play time, position, money and eight badge flags from the two save blocks through pointer regions, so a moved `gSaveBlock1Ptr` is followed and a null pointer gives a 503 `no_data`. Money is XORed with the key at save block 2 offset 0xAC and stays unsigned. The section is `gMapHeader.regionMapSectionId` with its name from the location table, and a play time with minutes, seconds or frames above 59 fails the resource. Badge names are a hand-kept list by art version, `null` for hack profiles. The profile gains a typed `player` block (badge flags 0x867 to 0x86E, money 0x490, flags 0x1270, key 0xAC) and a `gMapHeader` address from `generate:profiles`, which is stable on a second run. `GET /api/v2/player` and the `player` topic are wired, and the API types, schemas and sync pairs are in place.

Report: [decision report](../assets/063-gen3-player-decoder-report.md). The Claude seat approved in round 1 (8). The Gemini and GPT seats were skipped (out of quota).

Timing: wall 11m, active 11m, user 0s, wait 0s, blocked 0s | implement 9m, audit 1m (1 round) | tools 110 (2 subagent) | limits 0, compactions 0, handoffs 1 | ctx peak 157k | cost $3.91 sonnet-5-5 + $0.01 haiku-5-5
