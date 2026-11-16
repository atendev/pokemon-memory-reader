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

## Handoff

Branch `t3/gen3-party-decoder`. Last audit round: 0 (no auditor started yet). Context hit 152k, so the first thread stopped mid-implementation.

Done (uncommitted before the wip commit, untested, never run):
- `scripts/generate-reference/{c,definition,extract,build,main}.ts`: the reference-data generator. Pins pokeemerald 731ad5b, pokefirered ce6406d, pokeruby 5784633 (same commits as assets/019-reference-data-pret-gba.md). Writes `server/src/reference/data/gen3-en.json` (names, species data with dex, move data, Latin and kana charmaps) and fails when repos disagree on a shared ID.

Left, in order:
1. Run `bun scripts/generate-reference/main.ts`. Fix extractor bugs (untested). Expect trouble in Emerald's items enum, `OLD_UNOWN` macros, Ruby Latin-1 text and `NATIONAL_DEX_*` constants. Add `generate:reference` to root package.json. Add `build.test.ts` with hand-written pret-syntax inputs only, never pret excerpts.
2. `server/src/reference/index.ts`: `referenceData("gen3","en")` loads the JSON. The `Charmap.decode` signature gains an optional third argument `"latin" | "kana"`; note this in the report as a sketch change.
3. `api/`: add zod (optional peer plus devDependency, run `bun install`), `api/src/schemas.ts` with `Pokemon` (amendment 016 §1 verbatim) and the party schema. Interfaces doc leaves party's top-level shape to this ticket. Plan: `{ pokemon: Pokemon[] }`, because published schemas are loose objects (spec §7.11). Record this as an owner-reviewable decision.
4. `server/src/format/{bytes,regions,types}.ts` copied from interfaces 004 sketch (lines 355-500). `server/src/format/gen3/` layouts and party decoder: 100-byte party mon, PID/OT xor key, 24 substructure orders (PID % 24), checksum, egg bit 30 of the IV word, nature `personality % 25`, shiny `(tid^sid^pidHi^pidLo) < 8`, met and ball from the origins word, status Toxic bit, `null` rules per amendment 016 §2.
5. Tests: synthetic encrypt, round-trip, bad checksum, empty slot, egg, shiny; validate output against the api schema. No ROM bytes.
6. Surface a ticket for location names (met.location name stays null until then).
7. Audit (haiku, up to 5 rounds), decision report to `assets/008-gen3-party-decoder-report.md` with unslop, commit, push, PR against `wayfinder/v2-build-master`.

Files to read first: `.plan/maps/v2-build/assets/016-pokemon-schema-amendment.md` §1-2, `004-core-module-interfaces.sketch.ts` lines 355-500, `019-reference-data-amendment.md`, `server/src/profile/schema.ts`, `scripts/generate-reference/*.ts`.
Pret files fetched for inspection live in /tmp/pret-e, /tmp/pret-f and /tmp/pret-r, which may be gone.
