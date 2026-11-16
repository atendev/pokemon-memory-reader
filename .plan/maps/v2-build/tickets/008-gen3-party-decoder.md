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

Branch `t3/gen3-party-decoder-1` (cut from `t3/gen3-party-decoder` at f636689). Last audit round: 0, no auditor started. Second thread hit the 150k limit.

Done and committed:
- Generator runs. `bun run generate:reference` writes `server/src/reference/data/gen3-en.json` (412 species, 355 moves, 377 items, 77 abilities, dex, types, charmaps). The agreement check passes across the three pret repos. `scripts/generate-reference/build.test.ts` has 16 passing tests on hand-written inputs.
- Fixes made: `{POKEBLOCK}` prints `POKéBLOCK`; Ruby growth constants come from `include/pokemon.h` (new `growthConstants` role); Emerald items key by constant, with TM keys taking their own ID; Ruby and FireRed items go by list position; charmap alias U+22EF to U+2025 (kana 0xB0 differs between repos); a byte with several glyphs takes its ASCII one. Report these as decisions.

Left, in order (steps 2-7 of the older plan still stand):
1. `server/src/reference/index.ts` with `referenceData("gen3","en")`; `Charmap.decode(bytes, maxLength?, set?)`. 0xFF terminates. Unmapped byte gives U+FFFD.
2. `api/`: zod optional peer plus devDependency, `bun install`, `api/src/schemas.ts` with `Pokemon` (amendment 016 §1) and party `{ pokemon: Pokemon[] }`.
3. `server/src/format/{bytes,regions,types}.ts` from the sketch (skip `measureBatch`; `Decoder` holds only `party`), then `format/gen3/` party decoder.
4. Tests, then surface a location-names ticket, audit, report, push, PR.

Verified from pokeemerald 731ad5b: party mon is 100 bytes; substructs at 0x20 (48 bytes), status u32 at 0x50, level 0x54, hp 0x56, maxHp 0x58, then atk, def, spe, spa, spd. Order table: type positions per `PID % 24` are (0,1,2,3) (0,1,3,2) (0,2,1,3) (0,3,1,2) (0,2,3,1) (0,3,2,1) (1,0,2,3) (1,0,3,2) (2,0,1,3) (3,0,1,2) (2,0,3,1) (3,0,2,1) (1,2,0,3) (1,3,0,2) (2,1,0,3) (3,1,0,2) (2,3,0,1) (3,2,0,1) (1,2,3,0) (1,3,2,0) (2,1,3,0) (3,1,2,0) (2,3,1,0) (3,2,1,0), where type 0 growth, 1 attacks, 2 EVs, 3 misc sits at that position. Checksum is the u16 sum of the 24 words, stored at 0x1C. Status bits: sleep 0-2, poison 3, burn 4, freeze 5, paralysis 6, toxic 7. Flags byte at 0x13: bit0 badEgg, bit1 hasSpecies. EV order hp, atk, def, spe, spa, spd. Egg OT name is in the game's language, not Japanese, so eggs decode OT with kana only when the profile language is `ja`.

Decisions to report: bad checksum or bad egg fails the whole party (sketch); empty slot is a slot beyond the count, and species 0 inside the count fails; ability id 0 gives null; ball outside 1-12 gives null.

Files to read first: this ticket, `scripts/generate-reference/{extract,build}.ts`, amendment 016 §1-2.
