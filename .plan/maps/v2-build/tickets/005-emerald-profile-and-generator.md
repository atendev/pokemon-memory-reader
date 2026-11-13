---
type: task
blocked_by: [001, 004]
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
