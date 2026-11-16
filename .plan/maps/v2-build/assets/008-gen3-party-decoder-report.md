# Gen 3 party decoder: decision report

Ticket: [Gen 3 party decoder](../tickets/008-gen3-party-decoder.md). Work spanned three implementer threads. All decisions below were made by the implementer (main thread) unless noted. The auditor's verdict is at the end.

## What was built

- `scripts/generate-reference/` and `bun run generate:reference`: a dev-time generator that reads pret Ruby, Emerald and FireRed at pinned commits, checks that the three repos agree, and writes `server/src/reference/data/gen3-en.json` with provenance (412 species, 355 moves, 377 items, 77 abilities, dex numbers, types, two charmaps).
- `server/src/reference/index.ts`: `referenceData("gen3", "en")` and `createCharmap`.
- `api/src/schemas.ts`: `Pokemon` and `Party` (`{ pokemon: Pokemon[] }`) from amendment 016 §1. `zod` is an optional peer dependency and a dev dependency of `api/`.
- `server/src/format/{bytes,regions,types}.ts` and `format/gen3/{structs,mon,party,index}.ts`: the decoder contract from interfaces 004 and the Gen 3 party decoder.
- `server/test/gen3/`: a synthetic encoder (encrypt, shuffle, checksum) and 30 tests.

No ROM bytes are committed. Test mons are built from a hand-written encoder.

## Decisions

1. **A bad checksum or a bad egg fails the whole party.** Options: fail the party, or drop the one slot. Chose the interfaces 004 sketch (fail). The failure reason names the slot.
2. **An empty slot is a slot beyond the count byte; species 0 inside the count fails.** The flags `hasSpecies` bit is not consulted. A count above 6 fails.
3. **Ability id 0 gives `null`.** A second ability slot of 0 falls back to the first, as `GetMonAbility` does.
4. **A ball outside 1-12 gives `null`.** A held item of 0 also gives `null`.
5. **Egg OT decodes with kana only when the profile language is `ja`.** A hatching egg stores its OT in the game's language, not Japanese, even though its language byte says Japanese. Non-egg mons choose the character set from their own language byte.
6. **`dex` is `null` above 386.** The generated rows number pokeemerald's "?" placeholder species 387 and up. Those are not National Dex entries.
7. **Generator fixes made while running it:** `{POKEBLOCK}` prints `POKéBLOCK`; Ruby growth constants come from `include/pokemon.h` (a new `growthConstants` role); Emerald items key by constant, with TM keys taking their own ID; Ruby and FireRed items go by list position; charmap glyph U+22EF maps to U+2025 because the repos disagree on kana 0xB0; a byte with several glyphs takes its ASCII one.
8. **`Decoder` holds only `party`.** Growth curves and `measureBatch` from the sketch are left out. Nothing in this ticket needs them. `DecodeContext` omits `growth` for the same reason.
9. **`met.location.name` is `null` for every location until location names ship.** The context's `names.locations` is a stub, and 0xFD-0xFF never get a name. A follow-up ticket covers the Gen 3 location-name reference data.
10. **Status precedence.** Toxic (bit 7) is checked first, then sleep (bits 0-2), then poison, burn, freeze, paralysis.
11. **Schemas are loose objects with closed enums**, per amendment 016 §3 and spec §7.11.

## Verification

- The 24-entry substructure order table is built from the order strings and tested against the position table in pokeemerald. Every order round-trips the same mon.
- Tests cover a bad checksum, a bad egg, species 0, count above 6, an empty slot (garbage beyond the count is never read), an egg, and a shiny and a non-shiny.
- Output of a two-mon party validates against `Party`.
- `bun run lint`, `bun run typecheck` and `bun test` pass, except the existing Lua version test, which fails on this machine because it has Lua 5.5 (CI pins 5.3 and 5.4).

## Audit

Pending.
