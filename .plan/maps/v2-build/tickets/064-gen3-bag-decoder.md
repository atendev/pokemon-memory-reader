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

## Answer

Built the Gen 3 `bag` resource for Emerald. `gen3Bag` reads the five pockets (items, keyItems, balls, tmhm, berries) from save block 1 through pointer regions, so a moved `gSaveBlock1Ptr` is followed and a null pointer gives a 503 `no_data`. Each slot is a u16 item ID and a u16 quantity, and quantities are XORed with the low 16 bits of the key at save block 2 + 0xAC, which pokeemerald's `GetBagItemQuantity` confirms. Item ID 0 is skipped, quantity 0 and above 99 are kept, and an unknown ID keeps its number with a null name. The profile `bag` block holds two arrays, `pocketOffsets` and `pocketCapacities`, written by `generate:profiles` with a stable second run. The bag reuses `player.encryptionKeyOffset` for the key. `GET /api/v2/bag` and the `bag` topic join the app with the `PocketId`, `BagEntry`, `Pocket` and `Bag` types, schemas, sync pairs and `PAIRED` entries.

Report: [decision report](../assets/064-gen3-bag-decoder-report.md). The Claude seat approved in round 1 (8). The Gemini and GPT seats were skipped (out of quota).

Timing: wall 5m, active 5m, user 0s, wait 0s, blocked 0s | implement 3m, audit 59s (1 round), gate 40s | tools 46 (4 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 132k | cost $1.60 sonnet-5-5 + $0.01 haiku-5-5
