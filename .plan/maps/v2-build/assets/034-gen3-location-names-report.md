# Gen 3 location names reference data: decision report

Ticket: [Gen 3 location names reference data](../tickets/034-gen3-location-names.md). One implementer thread built this and made every decision below unless noted. The audit verdict is at the end.

## What was built

- The reference generator reads `src/data/region_map/region_map_sections.json` from each pinned pret repo and writes `names.locations` into `server/src/reference/data/gen3-en.json`, one table per art version: `ruby-sapphire` (pokeruby, 87 IDs), `emerald` (pokeemerald, 213) and `firered-leafgreen` (pokefirered, 197).
- `referenceData("gen3", "en").locations(artVersion)` returns a lookup. An art version with no Gen 3 table gives a lookup that always returns `null`.
- `bindGame` passes `reference.locations(profile.artVersion)` to the Gen 3 decoder, so `met.location.name` is filled.
- No ROM bytes are committed.

## Decisions

1. **List position is the numeric section ID.** Amendment 019 left this open. pret builds `region_map_sections.h` from `region_map_sections.constants.json.txt` as `enum { {{ map_section.id }}, ... }` in list order, in all three repos, so the position is the ID a mon stores. The extractor also fails on a missing `MAPSEC_` id or a repeated one.
2. **Each repo keeps its own table.** The other tables must agree across repos or the build fails. Location tables differ by game (amendment 019 §4), so `buildReference` takes exactly one source per art version and fails on a missing or doubled one. Ruby and Sapphire share a table, as do FireRed and LeafGreen.
3. **Unnamed sections are `null`.** pokefirered lists the Hoenn sections with no `name`, and Ruby's `MAPSEC_DYNAMIC` has an empty one. Both stay out of the table, as do IDs past its end.
4. **`{NAME_END}` is dropped.** Ruby writes `LITTLEROOT{NAME_END} TOWN`. pokeruby's charmap says the code marks where a town or city name ends before " TOWN" or " CITY", so the full name is `LITTLEROOT TOWN`.
5. **`{AQUA}` prints `AQUA` and `{MAGMA}` prints `MAGMA`.** Emerald's `MAPSEC_AQUA_HIDEOUT_OLD` is `{AQUA} HIDEOUT`, next to a plain `AQUA HIDEOUT` entry. pokeemerald's `string_util.c` expands `{AQUA}` to `gText_ExpandedPlaceholder_Aqua`, which `strings.c` defines as `_("AQUA")` (`MAGMA` likewise), checked at the pinned commit after CI went green.
6. **`{EVIL_TEAM}` prints `MAGMA/AQUA`.** pokeruby's charmap says it is Magma in Ruby and Aqua in Sapphire. The two share one table and the profile cannot tell them apart, so the name shows both teams in Ruby, Sapphire order. Options were `null` or one team; both would hide or misstate the hideout. This is the one name that is not a plain game string, and it affects a single section (ID 66, `MAPSEC_EVIL_TEAM_HIDEOUT`).
7. **Any other control code in a name still fails the run.** `printCodes` is shared with the item, species and move readers, so the three new codes also apply there. None of those tables contains them.
8. **`ReferenceData` gains `locations(artVersion)`.** `names` keeps its type, `Omit<Names, "locations">`. The art version comes from the profile, and `referenceData` takes only a format and language, so a lookup per art version fits better than a second argument. `ArtVersion` is now exported from the profile schema.
9. **The generated JSON is biome-formatted.** `generate:reference` writes compact rows and `biome check --write` expands them, which matches the committed file. The diff of the data file is 509 added lines and 1 removed.
10. **The Gen 3 party test uses the real table.** Its stub mapped ID 9 to `PETALBURG CITY`. In the generated Emerald table, 9 is `MAUVILLE CITY` (7 is Petalburg), so the test expects the real name. The tracer test builds its direct decode with the same lookup, so it still matches the API output.

## Verification

- Generator tests (hand-written pret-style JSON, none copied from pret) cover Emerald, FireRed/LeafGreen and Ruby/Sapphire shapes: IDs by position, unnamed and empty names left out, `{NAME_END}`, `{AQUA}`, `{EVIL_TEAM}`, a repeated or missing ID, an unknown control code, per-art-version tables in the built file, and a missing or doubled source.
- `server/test/gen3/locations.test.ts` binds the Emerald profile, decodes a synthetic party mon, and gets `PETALBURG CITY` for section 7. It also checks Pallet Town (88) in the Emerald and FireRed tables, a null name for a Hoenn ID under FireRed, a null name for a Kanto ID under Ruby, a null name for an art version with no table, and that no table keeps a control code.
- `bun run lint`, `bun run typecheck` and `bun test` pass, except the existing Lua version test, which fails on this machine because it has Lua 5.5 (CI pins 5.3 and 5.4).

## Audit

One haiku auditor ran one round. Verdict: APPROVE in round 1.

The auditor ran the tests and the server typecheck, and read the shipped tables: 87, 213 and 197 entries, Petalburg at 7 and Mauville at 9 in Emerald, Pallet Town at 88, FireRed's Hoenn entries null, and no control codes or blank names. It judged each acceptance criterion met. It raised three non-blocking notes:

1. Ruby and Sapphire share one table, so both show `MAGMA/AQUA HIDEOUT` (decision 6). A profile `game` field could split it later.
2. The ID 9 expectation in the party test now rests on the list-position rule (decision 1), checked against pret's constants template and not against game data.
3. The extractor tests pass layout `emerald` for the Ruby and FireRed section fixtures. `mapSections` ignores the layout, so this is harmless.
