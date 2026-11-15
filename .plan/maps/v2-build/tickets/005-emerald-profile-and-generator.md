---
type: task
blocked_by: [001, 004, 013, 018, 019]
claimed_by: wayfinder-master v2-build-master-1794786410
claimed_at: 2026-11-15T23:46:50Z
---

# Emerald profile and generator

## Question

Build the game profile Zod schema, the dev-time generator, and the first generated profile, `emerald-us-1.0`. Follow the spec sections on game profiles and identification.

- The profile schema covers every required field the spec names, including `kind`, `artVersion`, the identification header and signature fields, and the hack-only `names` and `speciesData` fields.
- The generator reads the pret `symbols` branch for pokeemerald at a pinned commit. It extracts the hand-kept Gen 3 symbol list and writes addresses with provenance (repo, commit SHA, symbol file). Its output is committed. Tests run on a checked-in excerpt of the symbol file, never a network fetch.
- Built-in profiles are embedded in the server and load through the registry from Core module interfaces. User profiles are not part of this ticket.

## Acceptance

- Running `bun run generate:profiles` twice gives no diff.
- The schema rejects malformed profiles in tests.
- The Emerald profile passes the schema and records its provenance.

## Handoff

Branch `t3/emerald-profile-generator`, wip commit on its tip. Audit round 0 (no auditor started yet). Auto mode is on: decide yourself, haiku audits.

Done and green locally (lint, typecheck, 53 tests, `bun run generate:profiles` twice with no diff):
- `internal/src/memory.ts` (+test): address map, `parseAddress`, `parseProfileAddress`, `mapPointerValue` (amendment §17.1). Ticket 006 may also add this file, so expect a merge conflict.
- `server/src/profile/{address,schema,registry}.ts` (+tests): file schema (JSON Schema export), full schema (translates addresses, hack rules), `loadProfiles` with amendment 018's three steps, `byHash`, `byHeader`. `server/src/format/*/profile.ts` hold the per-format address blocks.
- `scripts/generate-profiles/` (sym parser, definitions, build, main, excerpt fixture) and the generated `server/src/profile/builtin/` (excluded from Biome). Root `generate:profiles` script and `scripts/tsconfig.json`.

Left, in order:
1. Audit on `haiku` (brief: ticket question, map Notes and Decisions, full diff, scope and 5-call limit).
2. Decision report `.plan/maps/v2-build/assets/005-emerald-profile-and-generator-report.md`, run unslop, commit with the work.
3. Push without forcing, open a PR against `wayfinder/v2-build-master`, return PUSHED.
4. Resolution: `## Answer` in this file, delete this section. Return Decisions line.

Implementer decisions to report: signature words are gSpeciesInfo 0x1BC, gItems 0x1C8, gBattleMoves 0x1CC (header offsets counted from pokeemerald `rom_header_gf.c`); `moveData` is inherited whole like a scalar; trainer-table counts are symbol size over entry size (40, 13, 2); Emerald hashes hand-kept from the 019 hash research and re-checked against pret `rom.sha1` and the libretro No-Intro DAT; the §026 batch-cap check in `loadProfiles` is not built (no ranges or `BRIDGE_CAPS` exist yet); `fixture` is `"none"`; hash generation from pret/No-Intro is not automated (surface a ticket).

Read first: this ticket, `server/src/profile/schema.ts`, `registry.ts`, `scripts/generate-profiles/build.ts`.
