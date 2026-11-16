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

Branch `t3/gen3-party-decoder-2-impl` at a0030ab (cut from `t3/gen3-party-decoder-1` at 7e5b7bd). Last audit round: 1 of 5. Third thread hit the 150k limit.

Done and committed (wip:): everything except the audit verdict, report finish, PR.
- Generator and `server/src/reference/data/gen3-en.json` (earlier threads).
- `server/src/reference/index.ts` (`referenceData`, `createCharmap`), `api/src/schemas.ts` (`Pokemon`, `Party`; zod optional peer + devDependency), `server/src/format/{bytes,regions,types}.ts`, `format/gen3/{structs,mon,party,index}.ts`, `server/test/gen3/{encode,party}.test.ts` (36 tests).
- Lint and typecheck clean. `bun test` passes except `core.test.ts` Lua version check (local Lua 5.5, not a regression).
- Draft report at `.plan/maps/v2-build/assets/008-gen3-party-decoder-report.md`; its "Audit" section says Pending.

Audit round 1 (haiku) raised: (1) personality >= 2^31 might go signed: `Bytes.u32le` uses `DataView.getUint32`, so it is unsigned; test added. (2) second-ability positive test: added (species 386). (3) egg OT kana path: added test. (4) `POSITIONS` in `encode.ts` is hand-written from pokeemerald, not copied from structs.ts. (5) reference-value expectations are checked by the passing tests.

Left, in order:
1. Start a new haiku auditor. Brief: ticket question, Notes, the fixes above, the files `server/src/format/gen3/{mon,structs,party}.ts`, `api/src/schemas.ts`, `server/test/gen3/party.test.ts`. Round 2 onward.
2. Fix any problems, re-audit until APPROVE (max round 5).
3. Update the report's Audit section with the verdicts and add decision 12: personality stays unsigned. Run unslop on the report.
4. Surface a ticket: "Gen 3 location names reference data | task | blocked-by 008" (`names.locations` is a stub, so `met.location.name` is null).
5. Commit with a non-wip message. Push without force. Open a PR against `wayfinder/v2-build-master` if the repo uses PRs, link it, and return PUSHED.

Files to read first: this ticket, the report, `server/src/format/gen3/mon.ts`.
