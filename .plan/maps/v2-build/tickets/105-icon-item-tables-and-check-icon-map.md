---
type: task
blocked_by: []
---

# Icon item ID tables and `check-icon-map`

## What to build

[`/icons` route and cache](./086-icons-route-and-cache.md) ships `ITEM_SLUGS` empty, so every item icon request answers 404, and Gen 1-2 species answer 404 until their dex tables exist. Fill `ITEM_SLUGS` per art version from PokeAPI `item_game_indices`, add the `check-icon-map` HEAD script that checks every mapped slug resolves upstream, and add the Gen 1-2 species dex tables. Read the 086 report and `docs/icon-packs.md` first. Generated tables are checked in, and the generator run is stable.

## Acceptance criteria

- Item requests resolve for Emerald, FireRed and LeafGreen items that PokeAPI has art for, and the rest still answer 404.
- `check-icon-map` reports every mapped slug that doesn't resolve, and CI doesn't call the network unless a job opts in.
- Gen 1-2 species requests resolve once their reference data is present.
- No third-party icon files are committed.
