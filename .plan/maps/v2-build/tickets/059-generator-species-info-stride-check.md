---
type: task
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794938032
claimed_at: 2026-11-17T17:54:38Z
---

# Check the species-info stride in the profile generator

## What to build

Decision 1 of the [023 amendment](../assets/023-cfru-species-layout-and-signature.md). For every pret repo it reads, `generate:profiles` checks that the species-info symbol's size equals the species count times `0x1C`, and fails the run with a message naming the repo, symbol, size and count otherwise. The species count is the one the reference generator uses for that repo's data format (412 for pokeemerald, matching the 412 species in `gen3-en.json`); the check takes it as an argument so tests can pass it directly. Today that is `pokeemerald.sym`, where `gSpeciesInfo` is `0x2D10` bytes for 412 species. Later pret repos get the same check as their profiles land, whichever name their commit uses for the table (`gSpeciesInfo` or `gBaseStats`).

## Acceptance criteria

- `generate:profiles` fails with a clear message when the size isn't species count × `0x1C`, and the Emerald profile is unchanged on a passing run.
- A default-suite test runs the check on the committed `pokeemerald.excerpt.sym`, plus a synthetic excerpt that must fail.
- No ROM bytes are read or committed.

Timing: wall 4m, active 3m, user 0s, wait 45s, blocked 0s | setup 38s, implement 46s, audit 1m (1 round), ci 1m | tools 41 (2 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 108k | cost $1.09 sonnet-5-5 + $0.01 haiku-5-5

## Answer

Built as decision 1 of the [023 amendment](../assets/023-cfru-species-layout-and-signature.md), in PR 41. The council approved in round 1 (claude 8, gemini 10, gpt 9) and all four CI checks passed. The decision report is [059-generator-species-info-stride-check-report.md](../assets/059-generator-species-info-stride-check-report.md).

- `scripts/generate-profiles/stride.ts` exports `checkSpeciesInfoStride(repo, symbols, table)`. It fails when the species table symbol is not `speciesCount * 0x1C` bytes, and the message names the repo, symbol, size and count.
- `ProfileDefinition` has a required `speciesInfo: { symbol, speciesCount }`. Emerald sets `gSpeciesInfo` and 412. Each later pret repo sets its own symbol (`gSpeciesInfo` or `gBaseStats`) and count, and a test pins Emerald's 412 to the length of `speciesData` in `gen3-en.json`.
- `planGeneration` runs the check for every built definition before hash resolution, so a bad symbol file fails the run before any file is written. The Emerald profile is unchanged on a passing run.
- `stride.test.ts` runs the check on the committed `pokeemerald.excerpt.sym` and on resized synthetic excerpts that must fail. No ROM bytes are read or committed.

Why: the symbol size states the retail layout without reading the ROM, and the count lives in each definition because the reference generator has no species-count constant to import. Declined: four minor audit notes, listed in the report. No ticket surfaced.
