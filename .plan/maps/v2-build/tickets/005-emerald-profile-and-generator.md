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

## Answer

Built the profile schemas (file and full), the registry loader with amendment 018's three steps, the `internal/src/memory.ts` address map, and `bun run generate:profiles`. The generator reads pokeemerald `pokeemerald.sym` from the `symbols` branch at `4a73ce73964859d53a2d21e58db2525e8fa4b31b`, checks the SHA-1 against pret's `rom.sha1` at a pinned commit, and writes the committed `server/src/profile/builtin/emerald-us-1.0.json` with provenance. Running it twice gives no diff, the schema tests reject malformed profiles, and tests use a checked-in symbol excerpt. The signature words are gSpeciesInfo 0x1BC, gItems 0x1C8 and gBattleMoves 0x1CC. Every decision is in [the report](../assets/005-emerald-profile-and-generator-report.md).

Why: the offsets are summed from `struct GFRomHeader`, trainer counts are symbol size over entry size, and `moveData` is inherited whole because it describes one table.

Not done: the decision 026 batch-cap check (no ranges or `BRIDGE_CAPS` yet), loading built-ins at server startup, automated hash lists, and a ROM check of the signature offsets.

