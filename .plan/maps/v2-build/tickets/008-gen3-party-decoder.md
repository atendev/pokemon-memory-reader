---
type: task
blocked_by: [004, 005, 016, 019]
---

# Gen 3 party decoder

## Question

Build the Gen 3 data format's party decoder and the Gen 3 English reference data it needs. Follow the decoders, reference data and API contract sections of the spec.

- Decrypt and unshuffle the substructures, verify checksums, and decode every party field the API schema defines: nickname via the Gen 3 charmap, species, moves, stats, IVs, EVs, nature, ability, gender, shininess, status, held item, and so on. Return `null` for fields the spec says are missing.
- Get species, move, item and ability names and species data for official games from reference data that a dev-time script generates from pret sources, with provenance.
- The output validates against the API package's party schema. Add the party schema to `api/` if Core module interfaces didn't.

## Acceptance

- Tests build party bytes synthetically by encrypting known mons, round-trip them, and cover a bad checksum, an empty slot, an egg and a shiny.
- No ROM bytes are committed.
