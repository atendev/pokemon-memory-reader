---
type: task
blocked_by: []
---

# Check the species-info stride in the profile generator

## What to build

Decision 1 of the [023 amendment](../assets/023-cfru-species-layout-and-signature.md). For every pret repo it reads, `generate:profiles` checks that the species-info symbol's size equals the species count times `0x1C`, and fails the run with a message naming the repo, symbol, size and count otherwise. The species count is the one the reference generator uses for that repo's data format (412 for pokeemerald, matching the 412 species in `gen3-en.json`); the check takes it as an argument so tests can pass it directly. Today that is `pokeemerald.sym`, where `gSpeciesInfo` is `0x2D10` bytes for 412 species. Later pret repos get the same check as their profiles land, whichever name their commit uses for the table (`gSpeciesInfo` or `gBaseStats`).

## Acceptance criteria

- `generate:profiles` fails with a clear message when the size isn't species count × `0x1C`, and the Emerald profile is unchanged on a passing run.
- A default-suite test runs the check on the committed `pokeemerald.excerpt.sym`, plus a synthetic excerpt that must fail.
- No ROM bytes are read or committed.
