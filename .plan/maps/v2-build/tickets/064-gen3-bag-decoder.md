---
type: task
blocked_by: [062]
claimed_by: wfm-v2-build-master-1795256075
claimed_at: 2026-11-21T11:02:23Z
---

# Gen 3 bag decoder and `bag` resource

## What to build

Build the `bag` resource for the Gen 3 data format on Emerald, following spec §7.7 and [the 017 amendment](../assets/017-player-and-bag-shapes.md): `{ pockets: { id, capacity, items: { item, quantity }[] }[] }` with the closed `PocketId` (items, keyItems, balls, tmhm, berries). Pocket capacities and addresses come from a profile `bag` block that `generate:profiles` writes from pret symbols.

Emerald XORs item quantities with the low half of the save encryption key, so confirm the fields in pokeemerald first. Items are item references into the Gen 3 items table, and an id missing from the table keeps its numeric id with a null name. `GET /api/v2/bag` and the `bag` topic join the app, with the type, sync pair and `PAIRED` entry the API package now requires.

## Acceptance criteria

- `GET /api/v2/bag` returns five pockets with decrypted quantities on synthetic Emerald memory, and the response parses with the real schema.
- A test covers an empty pocket, a full pocket and an unknown item id.
- The Emerald profile gains its `bag` block from the generator with a stable second run.
- Type, schema and sync tests are in place. No ROM bytes are committed.
