---
type: task
blocked_by: [008]
claimed_by: wayfinder-master v2-build-master-1794807670
claimed_at: 2026-11-16T06:00:30Z
---

# Gen 3 location names reference data

## Question

[Gen 3 party decoder](./008-gen3-party-decoder.md) left `names.locations` as a stub, so `met.location.name` is `null` for every Gen 3 mon. Extend the reference generator to take English location names from the pinned pret commits, keyed by `artVersion` as [Where does reference data come from?](./019-reference-data-source.md) decided, and fill `met.location.name` from them.

## Acceptance

- Generator tests on hand-written pret-style input cover location names for Emerald, FireRed/LeafGreen and Ruby/Sapphire.
- A synthetic party mon decodes with a non-null `met.location.name`.
- No ROM bytes are committed.

## Answer

Gen 3 mons now carry `met.location.name`. The reference generator reads `src/data/region_map/region_map_sections.json` from each pinned pret repo and writes one table per `artVersion` into `gen3-en.json`: `ruby-sapphire` (87 IDs), `emerald` (213) and `firered-leafgreen` (197). `referenceData("gen3", "en").locations(artVersion)` returns the lookup, and `bindGame` passes the profile's table to the decoder. Merged through PR 20 with 4 green checks and an audit APPROVE in round 1. [Report](../assets/034-gen3-location-names-report.md).

- A section's list position is its numeric ID. pret builds the section constants as an `enum` in list order in all three repos, which settles the question amendment 019 left open.
- Each repo keeps its own table, because location tables differ by game. The generator fails on a missing or doubled source.
- Sections with no name (FireRed's Hoenn sections, Ruby's `MAPSEC_DYNAMIC`) and IDs past a table's end give `null`.
- Ruby's `{NAME_END}` drops out, `{AQUA}` and `{MAGMA}` print `AQUA` and `MAGMA` (checked in pokeemerald's `strings.c`), and `{EVIL_TEAM}` prints `MAGMA/AQUA`, since Ruby and Sapphire share one table. Any other control code fails the run.
- Excluded: splitting Ruby and Sapphire into separate tables, which would need a profile `game` field that amendment 019 rejected, and leaving `{EVIL_TEAM}` as `null`.
