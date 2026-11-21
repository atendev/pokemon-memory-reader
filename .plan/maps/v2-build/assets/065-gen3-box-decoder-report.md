# Decision report: Gen 3 box decoder and `boxes` schemas (ticket 065)

Branch `t3/gen3-box-decoder-schemas`, cut from `wayfinder/v2-build-master` at `5c0fe68`. The council ran the Claude seat only. Gemini and GPT seats skipped (out of quota). The Claude seat approved in round 1 with a score of 8.

## What was built

- `server/src/format/gen3/box.ts`: `gen3Boxes`, one `storage` region of 0x83D0 bytes at `gPokemonStorage`, and `unreadableBoxes()`. Wired into `gen3Decoder.boxes`, with a `boxes` part on the `Decoder` type.
- `server/src/format/gen3/mon.ts`: `decodeBoxMon` is the 80-byte decode that `decodePartyMon` now builds on. It reuses `readSecure`, so no substructure code is copied.
- `server/src/format/gen3/growth.ts`: the six growth curves as formulas and `levelFromExperience`. Checked against every level of every rate in pret's `gExperienceTables`, compiled with gcc: 0 mismatches.
- `server/src/format/gen3/structs.ts`: the `STORAGE` layout and `BOX_MON_SIZE`.
- `server/src/resource/box-corruption.ts`: a pure warn-once helper keyed by box index and slot, with `reset()` for a game change.
- `api/src/types.ts` and `api/src/schemas.ts`: `Box` and `Boxes`, with `.describe()` on `Box.slots` listing the null fields. `sync.test.ts` pairs both. The closed-enum snapshot gained 126 lines and lost none.
- Tests: `box.test.ts` (23), `growth.test.ts` (4), `box-corruption.test.ts` (3), plus schema and sync tests. No ROM bytes are committed.

## Decisions

| # | Question | Options | Choice | Made by |
| --- | --- | --- | --- | --- |
| 1 | Does this ticket add `boxes` to `TOPIC_NAMES`, `ResourceMap` and `resourceSchemas`? | Now, or with the route | With the route, in the box reads and routes ticket, as `battle` did. The snapshot test walks `Boxes` directly. | Implementer |
| 2 | What is an empty slot? | All-zero only, or species 0 | Species 0 with a valid checksum, which includes all-zero. The game treats species 0 as empty. A bad-egg flag is corrupt even with species 0. | Implementer |
| 3 | What happens when the `currentBox` byte is 14 or more? | `fail()`, or every box unreadable | An ok result of `unreadableBoxes()`. The memory isn't a storage block, and the spec makes a failed block an unreadable resource, not an absent one. | Implementer |
| 4 | Who builds the result for a failed storage read? | Decoder only, or the loop too | `unreadableBoxes()` is exported for the box reads ticket to use when the region read fails, since `decode` never runs then. | Implementer |
| 5 | What is the level of a mon with experience below level 2? | Game's 0, or 1 | 1. The game's own function returns 0 there, which isn't a level. | Implementer |
| 6 | What if the growth rate ID is not one of the six? | Treat as medium fast, or null | `null`. Rates 6 and 7 are unused copies, and the same goes for a species table that failed to load. | Implementer |
| 7 | Where does the once-per-slot warning live? | Inside the decoder, or a helper | A pure helper with an injected `Log`. Decoders stay pure (interfaces 004), and the loop ticket calls `report` and `reset`. | Implementer |
| 8 | Is an empty box name `null` or `""`? | Either | The decoded string as stored. `null` stays for formats with no names. | Implementer |
| 9 | Does the box request become non-empty in `declaredRegions`? | Now, or with the loop | With the loop. Ticket 066 says the request is no longer empty then. Only the comment changed. | Implementer |
| 10 | How does a boxed egg's `eggCycles` and `nickname` read? | Same as party | Same: `eggCycles` from friendship, nickname `null`, level computed. | Implementer |

## Audit

Round 1, Claude seat (haiku): APPROVE, score 8. Gemini and GPT seats skipped (out of quota).

| Problem | Seat | Outcome |
| --- | --- | --- |
| The snapshot file was missing from the diff, so "126 added, 0 removed" couldn't be checked | claude, minor | Declined. `git diff --numstat` shows `126 0` for the snapshot, and the file is generated. |
| The describe test only checked `level`, which is described as computed | claude, minor | Fixed. It now checks the three null-field phrases. |
| `currentBox >= 14` returns ok where decoders usually `fail()` | claude, minor | Declined. Decision 3 explains it, and the output is what the spec asks for. |

Minor problems declined: 2.

## Checks

- Server tests: 332 pass, 1 fail. The failure is `server/test/bridge/core.test.ts`'s Lua version check, because the host's default `lua` is 5.5 and CI uses 5.4.
- API tests: 33 pass, 1 skip (the open-enum baseline). Biome and all workspace typechecks pass.
- Gate used: this skill's rules. The repo has no `workflow.md`, and the master's brief set the commit and CI steps.
