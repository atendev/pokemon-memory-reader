---
type: task
blocked_by: [062]
claimed_by: wfm-v2-build-master-1795256075
claimed_at: 2026-11-21T10:25:54Z
---

# Gen 3 box decoder and `boxes` schemas

## What to build

Build the vanilla Gen 3 box decoder and the `boxes` schemas, following spec §6.5 and §7.9. A Gen 3 box is 14 boxes of 30 slots, read as one contiguous `PokemonStorage` of about 33 KB, with `currentBox` as its first byte and box names of up to 8 characters. Box Pokémon use the `Pokemon` schema with `hp`, `maxHp`, `stats` and `status` null, and `level` computed from experience and the growth rate. A checksum failure or bad egg gives a `null` slot listed in `corruptSlots`, logged once per box index and slot until the game changes. A failed storage read makes every box unreadable and `currentBox` null.

Reuse the party decoder's substructure code. Do not build the CFRU box layout here: Radical Red appears to store 58-byte compressed records ([Radical Red box layout](./061-cfru-box-storage-layout.md)), and the `cfru` format gets its own decoder after that ticket. The `Box` and `boxes` types follow the API sync rules.

## Acceptance criteria

- The decoder returns 14 boxes of 30 slots on synthetic memory, with `null` for empty slots, `corruptSlots` on a bad checksum and a bad egg, and `readable: false` boxes when the block fails.
- Names, wallpaper index and `currentBox` decode, and a boxed egg's level is computed like any other.
- Types, schema and sync tests are in place, and `.describe()` lists the null fields.
- No ROM bytes are committed.

## Answer

Built the vanilla Gen 3 box decoder. `gen3Boxes` reads all 0x83D0 bytes of `PokemonStorage` in one region through `gPokemonStorage` and returns 14 boxes of 30 slots. It decodes names (8 characters), wallpaper and `currentBox`. Empty slots (species 0, valid checksum) are `null`, and a checksum failure or bad egg is `null` and listed in `corruptSlots`. A `currentBox` of 14 or more gives every box unreadable, and `unreadableBoxes()` is there for the loop's failed read. `decodeBoxMon` is the 80-byte core that `decodePartyMon` now builds on. Box `level` comes from `levelFromExperience`, whose six curves match pret's tables at every level. `hp`, `maxHp`, `stats` and `status` are null. `Box` and `Boxes` are in `api/` with a `.describe()` that lists the null fields, and a pure warn-once helper is ready for the loop to call. `boxes` stays out of the topic record until the box reads and routes ticket.

Report: [decision report](../assets/065-gen3-box-decoder-report.md). The Claude seat approved in round 1 (8). The Gemini and GPT seats were skipped (out of quota).

Timing: wall 7m, active 6m, user 55s, wait 0s, blocked 0s | implement 5m, audit 1m (1 round) | tools 47 (2 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 144k | cost $1.76 sonnet-5-5 + $0.01 haiku-5-5
