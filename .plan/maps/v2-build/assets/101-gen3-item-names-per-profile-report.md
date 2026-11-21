# Gen 3 item names per profile: decision report

Ticket: [Gen 3 item names per profile](../tickets/101-gen3-item-names-per-profile.md). One implementer thread built this and made every decision below unless noted. The audit verdict is at the end.

## What was built

- The reference generator keeps one item-name table per art version (`ruby-sapphire`, `emerald`, `firered-leafgreen`) in `names.items` of `server/src/reference/data/gen3-en.json`, the same way `names.locations` is keyed. Lengths are 349, 377 and 375.
- `referenceData("gen3", "en").items(artVersion)` returns a lookup. An art version with no Gen 3 table gives a lookup that always returns `null`. `bindGame` passes `reference.items(profile.artVersion)` to the decoder, so bag rows, held items, balls, Trainer items and battle held items all read the profile's own table.
- The icon-map generator takes the same per-art-version names, so `icon-maps.json` no longer lists an icon for an item ID the game has no name for.
- No ROM bytes are committed.

## What the gap was

At the pinned pret commits the three repos agree on every item ID they share. The merged table still leaked. Emerald's 375 (MAGMA EMBLEM) and 376 (OLD SEA MAP) named IDs in FireRed and LeafGreen, which end at 374. FireRed's key items at 349 to 374 named IDs in Ruby and Sapphire, which end at 348. The 077 report said FireRed and LeafGreen got wrong names; the real fault was this leak, not a clash between games.

## Decisions

1. **Key items per art version, not per repo or per profile.** Options: keep the merged table and fail on a clash, key by art version, or key by profile ID. Chosen: art version, as location names are in ticket 034 and as the ticket asks. Ruby and Sapphire share a table, as do FireRed and LeafGreen. Profile ID would copy one table across the four FireRed and LeafGreen profiles. Made by the implementer.
2. **Drop the cross-repo `agree` check for items.** Each repo keeps its own table and the generator fails on a missing or doubled source, as it does for locations. The two lookups share one `perArtVersion` helper. Made by the implementer.
3. **Rename `LocationKey` to `ArtKey` and the `locationKey` field to `artKey`.** The key now serves two tables. Made by the implementer.
4. **`ReferenceData.names` loses `items`.** It is now `Omit<Names, "locations" | "items">`, and `items(artVersion)` sits beside `locations(artVersion)`. Options: a single `namesFor(artVersion)` or the two lookups. Chosen: the two lookups, which match the existing shape and keep the change small. Every test that built a decode context now adds `items: reference.items("emerald")`. Made by the implementer.
5. **Icon maps follow the names.** The ticket does not mention icons, but `generate-icon-maps` read `names.items` and had to change to compile. Options: keep one merged array for icons, or go per art version. Chosen: per art version, so the icon table lists only IDs the game names. The regenerated `icon-maps.json` loses Ruby and Sapphire 349 to 376 and FireRed and LeafGreen 375 and 376. The ticket 105 test that asserted the three Gen 3 icon tables were equal now asserts that Ruby and FireRed tables are subsets of Emerald's with the same slugs, and checks the 376 and 349 cases. Made by the implementer.
6. **Stability.** The generator output is written, then formatted by Biome, as the committed file already was. Two runs gave the same SHA-1 (`b2505b47...`). A test builds the same fixtures twice and compares the rendered text.

## Tests

- `scripts/generate-reference/build.test.ts`: per-art-version item tables, an Emerald-only name absent from Ruby, FireRed's own name at the same ID, rendered text round-trips and is the same on a second build.
- `scripts/generate-icon-maps/build.test.ts`: a Gen 3 item name in one game gets no icon in another.
- `server/test/gen3/items.test.ts`: a bound Emerald party names OLD SEA MAP, FireRed and LeafGreen give `null` for 375 and 376, Ruby gives `null` for 349, each game names its own items, an art version with no table names nothing.
- Full `bun test`: 1681 pass, 21 skip, 2 fail on the first run. One failure was the icon table equality test, fixed in this diff. The other is the Lua 5.5 version check in `server/test/bridge/core.test.ts`, which was already failing and is unrelated. Typecheck and `biome ci` are clean.

## Skipped gates

The Jev audit was skipped as the brief said. The commit gate, CI and the map edit were left to the master. `bun install` was run in the worktree because `node_modules` was missing.

## Audit

Single-mode council, Claude seat only (haiku). Round 1: APPROVE, score 8, two minor problems, both fixed (a duplicated doc comment, and a test that compared a value with itself). Round 2 re-checked the two fixed hunks: APPROVE, score 9, no problems. Minor problems declined: none.
