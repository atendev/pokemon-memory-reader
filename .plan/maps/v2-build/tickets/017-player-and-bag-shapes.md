---
type: grilling
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794792924
claimed_at: 2026-11-16T03:41:12Z
---

# What shapes do `player` and `bag` have?

## Question

Spec §17 item 5. Decide the shapes of badges (Gen 2 has 16), map location and play time, the pocket list per generation, and the bag entry.

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

[Amendment 017](../assets/017-player-and-bag-shapes.md) settles both shapes. It was decided in auto mode, and the haiku audit approved it in round 3. The [decision report](../assets/017-player-and-bag-shapes-report.md) lists every decision.

- `player` is `{ name, trainerId, secretId | null, money, badges, location, playTime }`. `badges` is `Badge[]` of `{ id, name | null, obtained }`, 8 long in Gen 1 and Gen 3 and 16 in Gen 2 (Johto, then Kanto). Badge names come from a hand-kept list keyed by art version, an explicit exception to 019, and are null for hacks. `location` is `{ mapGroup | null, mapNumber, x, y, section: Ref | null }`. `section` is the map section: the Gen 3 header value, the Gen 2 landmark, or the Gen 1 town-map entry. `playTime` is `{ hours, minutes, seconds, frames }` as stored, with `hours` unbounded in the schema.
- `bag` is `{ pockets: Pocket[] }` with `Pocket = { id, capacity, items }` and `BagEntry = { item: Ref, quantity }`. `PocketId` is a closed enum: `items` in Gen 1, plus `keyItems`, `balls` and `tmhm` in Gen 2, plus `berries` in Gen 3 and CFRU. `capacity` is the most distinct entries a pocket can hold, 57 for the Gen 2 `tmhm` pocket.
- Per-game offsets, capacities, badge flag IDs and the Gen 3 key offset live in the data format's profile block. A failed read fails the whole resource that cycle, as 013 decided. The viewer breaks the badge row at eight and draws pockets from the response.
- Excluded: coins, gender, rival name and PC item storage go to a v2.x map. PC storage would be a separate field, not a pocket. A boolean or bitmask badge field, an open pocket enum, slot indexes with null slots, and per-generation shapes were rejected.
