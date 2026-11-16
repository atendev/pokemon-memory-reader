---
type: task
blocked_by: [008]
---

# Gen 3 location names reference data

## Question

[Gen 3 party decoder](./008-gen3-party-decoder.md) left `names.locations` as a stub, so `met.location.name` is `null` for every Gen 3 mon. Extend the reference generator to take English location names from the pinned pret commits, keyed by `artVersion` as [Where does reference data come from?](./019-reference-data-source.md) decided, and fill `met.location.name` from them.

## Acceptance

- Generator tests on hand-written pret-style input cover location names for Emerald, FireRed/LeafGreen and Ruby/Sapphire.
- A synthetic party mon decodes with a non-null `met.location.name`.
- No ROM bytes are committed.
