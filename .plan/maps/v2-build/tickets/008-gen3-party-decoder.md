---
type: task
blocked_by: [004, 005, 016, 019]
claimed_by: wayfinder-master v2-build-master-1794792924
claimed_at: 2026-11-16T01:36:35Z
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

## Resolution

Built the Gen 3 party decoder, the dev-time reference generator with `server/src/reference/data/gen3-en.json` (412 species, 355 moves, 377 items, 77 abilities, with provenance), and the `Pokemon` and `Party` schemas in `api/`. Tests build parties from a synthetic encoder and cover a bad checksum, an empty slot, an egg and a shiny, and the output validates against `Party`. Audit approved in round 3, CI green on 5bf77d7 (PR 8). The decision report is `../assets/008-gen3-party-decoder-report.md`. Met location names stay null until a follow-up ticket ships Gen 3 location names.
