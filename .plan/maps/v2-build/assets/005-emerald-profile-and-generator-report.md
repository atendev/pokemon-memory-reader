# Decision report: Emerald profile and generator

Ticket: [Emerald profile and generator](../tickets/005-emerald-profile-and-generator.md), a `task` ticket run in auto mode as a child of the v2-build wayfinder-master. Branch `t3/emerald-profile-generator-1`, continued from the handoff commit `df6c670`. No grilling round ran, so every decision below was made by the implementer (main thread) and checked by the `haiku` auditor.

## What was built

- `internal/src/memory.ts`: the GBA address map, `parseAddress`, `parseProfileAddress` and `mapPointerValue` (decision 013 and amendment §17.1).
- `server/src/profile/`: the file schema (with JSON Schema export), the full schema that translates addresses and enforces hack rules, and `loadProfiles` with amendment 018's three steps, plus `byHash` and `byHeader` lookups. Per-format address blocks sit in `server/src/format/*/profile.ts`.
- `scripts/generate-profiles/`: a `.sym` parser, profile definitions, the build step, `main.ts` and a checked-in symbol excerpt used by tests.
- `server/src/profile/builtin/emerald-us-1.0.json`: the generated profile, with provenance `pret/pokeemerald` at `4a73ce73964859d53a2d21e58db2525e8fa4b31b`, file `pokeemerald.sym`. Biome skips the JSON and `index.ts`.

## Decisions

1. **Which header words form the Emerald signature?** Options: gSpeciesInfo, gItems and gBattleMoves; other table pointers. Chosen: gSpeciesInfo `0x1BC`, gItems `0x1C8`, gBattleMoves `0x1CC`. After audit round 1 the main thread fetched `src/rom_header_gf.c` from pret/pokeemerald and summed `struct GFRomHeader` field by field: speciesInfo `0xBC`, items `0xC8` and moves `0xCC` into the struct, which starts at ROM offset `0x100`. The derivation sits in the definitions comment. No ROM check is possible yet, so tier-1 verification stays with the fixture tickets. Implementer, prompted by the auditor.
2. **How does `extends` treat `moveData`?** Options: merge it field by field; inherit it whole. Chosen: inherit whole, like a scalar, because the block is one table description and a half-merged one would be unusable. Implementer.
3. **How are trainer-table counts found?** Options: hard-code counts; derive them. Chosen: symbol size divided by entry size (40, 13 and 2 bytes), giving 855, 66 and 112. A generator run against a new commit then updates the counts. Implementer.
4. **Where do the Emerald hashes come from?** Options: automate from pret `rom.sha1` and No-Intro; hand-keep; hand-keep and have the generator check the SHA-1. Chosen after audit round 1: hand-kept SHA-1 `f3ae088181bf583e55daf962a92bb46f4f1d07b7` and CRC32 `1f1c08fb` from the hash research for decision 019, and the generator fetches pret's `rom.sha1` at the pinned commit `1959b1afccf726b1145d7a07d9c5e678eaea158a` (the last commit on `master` that touched it; the symbols-branch commit has no such file) and fails if it disagrees. The CRC32 stays hand-kept, tied to the No-Intro entry "Pokemon - Emerald Version (USA, Europe)" by the matching SHA-1. Full automation of hash lists is a surfaced ticket. Implementer, prompted by the auditor.
5. **Is the batch-cap check from decision 026 built here?** Options: build it now; defer. Chosen: defer. No batch ranges or `BRIDGE_CAPS` exist yet, so the check has nothing to compare. Surfaced as a ticket. Implementer.
6. **What is `fixture` for Emerald?** Chosen: `"none"`, because the owner has no ROM and no verified fixture exists (map Notes). Implementer.
7. **Does the server load the built-ins at startup?** Options: wire it now; leave it. Chosen: leave it. The server has no startup code yet, and the ticket asks for the schema, generator, profile and a registry that loads the built-ins, which `builtin.test.ts` exercises. Surfaced as a ticket. Implementer, with the auditor asking for the gap to be stated.
8. **What does the registry do with two files that share an ID?** Chosen after audit round 1: report a problem for the later file and let it win, so no load is silent. Implementer, prompted by the auditor.
9. **Does a failed fetch leave profiles deleted?** Chosen after audit round 1: the generator fetches and renders everything in memory, then deletes and writes. Implementer, prompted by the auditor.
10. **Is the `names` field in the ticket the `nameTables` block?** Yes. Amendment 018 and interfaces 004 call the hack block `nameTables`; the ticket uses shorthand. Implementer.
11. **Where does generated output live, and is it linted?** Chosen: committed under `server/src/profile/builtin/`, embedded by an `index.ts`, and excluded from Biome (only `index.ts` and the JSON, not the hand-written test, which moved to `server/src/profile/builtin.test.ts`) so the generator's formatting is the only formatting. Implementer.

## Audit

One `haiku` auditor, three rounds, final verdict APPROVE.

- Round 1 raised eight points. The main thread fixed the hash evidence (decision 4), the signature offsets (1), the ordering of fetch and delete in `main.ts` (9), duplicate IDs (8), the Biome exclude, and the trainer-table count cap. It stated the missing startup wiring (7) and the `nameTables` question (10), and left the `gen1` and `gen2` placeholders to their own tickets.
- Round 2 found that the `rom.sha1` fetch used the moving `master` branch. The main thread pinned it to a commit.
- Round 3: APPROVE. The auditor read only the diffs. It did not verify the pret sources or the amendments, and accepted those claims on citation.

## Checks

- `bun run lint`, `bun run typecheck` and `bun test` (57 tests) pass.
- `bun run generate:profiles` run twice leaves no diff.
- Schema tests reject malformed profiles. Registry tests cover the loader, `byHash` and `byHeader`. Generator tests read only the checked-in excerpt.

## Known gaps

- `internal/src/memory.ts` may also be added by the Bridge protocol core ticket, so expect a merge conflict there.
- Hash lists are hand-kept. The generator only checks the SHA-1 against pret's `rom.sha1`.
- The server does not call `loadProfiles(builtinProfiles)` at startup yet.
- The `gen1` and `gen2` format blocks are placeholders that accept any address key. Their format tickets own the real shapes.
- The decision 026 batch-cap check is not built.
- The signature offsets have not been checked against a real ROM.
