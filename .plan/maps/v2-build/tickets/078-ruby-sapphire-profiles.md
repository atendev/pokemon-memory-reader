---
type: task
blocked_by: [063, 064, 065]
---

# Ruby and Sapphire profiles

## What to build

Add the English pokeruby builds (Ruby and Sapphire, with their revisions) to `generate:profiles`. Signatures use the two anchored words from [the 036 amendment](../assets/036-ruby-sapphire-signature-bytes.md), and the generator gains the anchored words with a size check. Ruby and Sapphire have no GF header, a static `gPokemonStorage` (spec §6.5) and, to be confirmed in pokeruby, no save encryption key. The `player`, `bag` and `battle` blocks come from pokeruby symbols. The same hash, provenance and evidence rules as the FireRed ticket apply.

## Acceptance criteria

- Every English Ruby and Sapphire revision pokeruby defines is generated or explicitly held back, with the reason in `SIGNATURE-EVIDENCE.md`.
- The anchored-word signature has a size check and a failing synthetic test.
- The decoders run on synthetic Ruby memory, including the static box address.
- No ROM bytes are committed.
