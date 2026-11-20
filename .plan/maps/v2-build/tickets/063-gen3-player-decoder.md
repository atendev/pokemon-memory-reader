---
type: task
blocked_by: [062]
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
