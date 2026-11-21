# Viewer identification and missing-field notes: decision report

Audit: Claude seat only (Gemini and GPT: not run). Round 1 disapproved, score 7, one blocking problem fixed. Round 2 approved, score 8, one minor problem declined.

## Decisions

1. **Where the notes show.**
   - Options: the sidebar status block; a banner in `App`; a list above each game screen.
   - Choice: one `IdentificationNotes` list above Party, Battle, Boxes and Trainer & bag, shown only once a game is identified. About, Settings and the connection screen don't show it, because the connection screen already explains why there is no game. By the main thread (implementer).

2. **Identification note wording and rules (spec §5.4, §11.1).**
   - A `header` match says it matched by header, and by header and signature when `signature` is `match`, not by hash.
   - A `manual` pick warns on `mismatch` that the data tables moved, and on `unchecked` that the program couldn't check the ROM. A clean manual pick shows nothing.
   - An `exact` match shows nothing, even on a `mismatch`: the spec says that case is a profile bug, logged by the server, not a viewer warning.
   - By the main thread. Header with `mismatch` can't reach the viewer, because ticket 072 leaves that ROM unidentified.

3. **What counts as a missing field.**
   - Options: any null value on a resource; the `names` and `speciesData` sources on `status.game`.
   - Choice: a source of `unavailable` is the profile saying it can't read that table, so the note lists the affected categories. A `null` source means the data format lacks the category, as with Gen 1 abilities, and gets no note. Per-field null detection was dropped because it can't tell "the profile can't read it" from "the game has nothing there". By the main thread.
   - The note says names show as `#<id>`. For species data it says the fields "show as — or stay blank" (Claude seat's blocking problem in round 1).

4. **Out of scope.** The expansion-ROM refusal and the missing-ROM-access core suggestion stay out. The ticket lists neither, and the server doesn't yet report an expansion block (`status.rom.expansion` is always null) or the ROM-access state the second note needs.

## Audit problems

- Round 1, blocking, fixed: the species-data note claimed "show as —" without evidence. Screens do show `—` for a null ability (`PartyScreen.tsx:75`) and level (`BoxesScreen.tsx:72,84`), but null types give no badge (`PartyScreen.tsx:49`). The text now says "show as — or stay blank".
- Round 1, minor, rebutted: the label maps could miss a key. `api/src/schemas.ts:376-386` has exactly `species`, `moves`, `items`, `abilities` and `info`, `dex`, `exp`.
- Round 1, minor, rebutted: a header match with a bad signature isn't explained. It never reaches the viewer (decision 2).
- Round 1, minor, answered: the compile-smoke claim had no output. Local run below.
- Round 2, minor, declined: the seat couldn't open `display.ts` and the screens to confirm the cited rendering, since they are outside the diff. The main thread read those lines before the reword.

## Checks

- `bun test viewer`: 259 pass, 0 fail. New tests are in `viewer/src/notes.test.tsx`.
- `bun run typecheck`: 0 errors. `biome ci .`: clean.
- Compile smoke run locally (`bun build --compile`, `bun scripts/smoke.ts`): passed. `server/test/e2e` skips without an emulator (17 skipped).
- CI not run, per the master's instructions.
