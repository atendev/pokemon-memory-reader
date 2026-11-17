# Report: Check the species-info stride in the profile generator

Ticket: [Check the species-info stride in the profile generator](../tickets/059-generator-species-info-stride-check.md). It builds decision 1 of the [023 amendment](./023-cfru-species-layout-and-signature.md). No grilling ran, because the amendment settled the design. The council approved in round 1 (claude 8, gemini 10, gpt 9).

## What changed

- `scripts/generate-profiles/stride.ts` is new. It exports `SPECIES_INFO_STRIDE` (`0x1C`) and `checkSpeciesInfoStride(repo, symbols, table)`, which throws when the table symbol's size is not `speciesCount * 0x1C`. The message names the repo, symbol, size, species count, stride and expected size.
- `ProfileDefinition` gains a required `speciesInfo: { symbol, speciesCount }`. Emerald sets `gSpeciesInfo` and 412.
- `planGeneration` runs the check for every built definition before it resolves hashes, so a bad symbol file fails the run before anything is written. Later pret repos set their own symbol name (`gBaseStats` or `gSpeciesInfo`) and count in their definition.
- `stride.test.ts` is new. It passes on the committed `pokeemerald.excerpt.sym`, fails on a resized synthetic excerpt, pins 412 to the length of `speciesData` in `gen3-en.json`, shows the symbol name and count are arguments, and shows `planGeneration` throws on a bad table.

## Decisions

**D1. Where the species count comes from.** Options: read it from `gen3-en.json` at generate time, or write it in the definition. Chosen: the definition, with a test that pins it to the length of `speciesData` in `gen3-en.json`. The reference generator has no species-count constant to import, and reading generated JSON from the profile generator would couple the two generators. Made by the implementer.

**D2. Where the check runs.** Options: in `main.ts` after fetching, or in `planGeneration`. Chosen: `planGeneration`, so a default-suite test reaches it without the network and the run still fails before any file is written. Made by the implementer.

**D3. Order inside `planGeneration`.** Options: after hash resolution, or before it. Chosen: before. A bad symbol file then shows the stride message and not a hash error that hides it. Made by the implementer.

**D4. The failing synthetic excerpt.** Options: a second fixture file, or the committed excerpt with the size rewritten in the test. Chosen: rewrite in the test, so the passing and failing inputs cannot drift apart. Made by the implementer.

## Evidence

- `bun run typecheck` passes in all workspaces and `bun run lint` is clean.
- `bun test scripts` gives 198 passes and no failures.
- `bun run generate:profiles` ran against the pinned pret commits. It left `server/src/profile/builtin` unchanged, so the Emerald profile is the same on a passing run.
- No ROM bytes are read or committed.

## Audit

Round 1: claude APPROVE 8, gemini APPROVE 10, gpt APPROVE 9. No blocking problem. The gate opened with no fix round.

| Problem | Raised by | Status |
| --- | --- | --- |
| The audit diff file in `scripts/` must not be committed. | claude, minor | Fixed. The file was deleted before the commit. |
| The comment "0x1A bytes of fields plus 2 of padding" has no evidence in the diff. | claude, minor | Declined. One seat raised it, and the amendment's facts section states the layout. |
| The failing path is shown only by the `planGeneration` unit test, with no CLI run. | claude, minor | Declined. One seat raised it, and the CLI calls `planGeneration` with the same input, so the unit test covers the same code. |
| The test "fails the whole generator run and writes nothing" never checks that nothing was written. | claude, minor | Declined. One seat raised it. `planGeneration` returns its files and writes none, so a throw means nothing was produced. |
| The test label "a table sized for another stride" uses sizes that are not multiples of `0x1C`. | claude, minor | Declined. One seat raised it, and the assertion holds for every size listed. |

## Left for later

The `test:local` hack check, the ledger row, the release-gate rule, the `find-rom-tables` stride measure and the wrong-stride synthetic test stay with the CFRU and hack profiles work, as the amendment's "What gets built when" lists.
