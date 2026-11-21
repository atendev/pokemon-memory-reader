# Decision report: SliceAdapter, fixture files and golden files

Ticket 091. Spec §12.1, §12.2, §12.3 and §12.5. Built against synthetic slices. No real capture exists yet.

## What shipped

- `server/src/fixture/file.ts`: the fixture schema, `parseFixture`, `loadFixture`, `serializeFixture`, `buildFixture` and the size caps (256 KB fixture, 1 MB sequence).
- `server/src/adapter/memory.ts`: `SliceAdapter`.
- `server/src/fixture/golden.ts`: the golden schema, `diffValues` and `assertGolden`.
- `server/test/support/run-fixture.ts`: runs a Gen 3 decoder part through `readBatch`, a `SliceAdapter` and the decoder.
- One committed synthetic fixture and golden under `server/test/fixture/synthetic/emerald-us-1.0/`, plus 20 tests in `server/test/fixture/`.

## Decisions

1. **How a fixture holding ROM-table bytes is rejected.**
   - Options: reject any `rom` domain region; scan other domains for ROM content; reject by profile table address.
   - Choice: reject any region in the `rom` domain, in the schema, with a message that cites §12.2. Made by the main thread.
   - Why: §12.2 says no fixture holds ROM data and the profile's ROM tables count as missing. A ROM table can only be read from the `rom` domain. Content scanning is impossible without the ROM.
   - Limit: the rule rests on the domain label. A copy of ROM bytes filed under `ewram` would pass. The test name says so.
2. **Where `SliceAdapter` lives.**
   - Options: `server/test/support/`; `server/src/adapter/memory.ts`.
   - Choice: `server/src/adapter/memory.ts`, as the module map in the core interfaces asset says. The capture tool ticket can import the fixture format from `src`. Made by the main thread.
3. **Merge gap.**
   - Choice: `limits.mergeGap` is 0. The read loop merges ranges closer than the gap, and a merged range could span bytes the capture never recorded. With 0, only adjacent or overlapping ranges merge.
   - Reads that cross two touching recorded regions are served. A gap between regions is never bridged.
4. **`SliceAdapter` state.**
   - Choice: connected, no bridge, no problem, `game.platform` from the data format, `crc32`, `sha1` and `romName` null, `domains` holding the recorded extent per domain with no `rom` key, `gameEpoch` 1. Per `Adapter` docs, no `rom` key means the adapter cannot read ROM.
   - The extent is not the emulator's real domain size. The code says so.
5. **Overlapping regions.** Rejected, because the bytes would be ambiguous.
6. **Golden shape.** `{ resources, verified }`, compared by deep equality. `assertGolden` returns one error listing every difference as `path: expected X, got Y`. `actual` goes through JSON first, so it matches the golden as the API would send it. No Bun snapshots.
7. **Synthetic fixture location.** It sits under `server/test/fixture/synthetic/`, not `server/test/fixtures/<profile-id>/`. That keeps the later coverage guard over `fixtures/` from taking synthetic data for a real capture. The size test walks both paths.
8. **Golden provenance.**
   - The synthetic golden came from decoder output. It was checked against the encoder inputs: species 277 and 280, nicknames, levels 5 and 12, hp 19 and 30.
   - `verified` is `[]`. No owner verified anything. The test proves regression stability, not game correctness.
9. **Not built.** The coverage guard's rules (a draft golden fails it, ROM-dependent nulls never go on `verified`) and sequence fixtures. Those belong to later tickets.

## Audit

Council with the single Claude seat. Gemini and GPT: not run, out of quota.

- Round 1: Claude DISAPPROVE, 7. One blocking item: it feared a populated `verified` list. Rebutted with `"verified": []` in the golden, which the seat could not see because the JSON was excluded from its diff. Eight minor problems were fixed: `Object.hasOwn` in the differ, a stray assertion removed, the directory walk's catch narrowed, a byte-for-byte round-trip check of the committed fixture, a decoder-driven failing-golden test, the domains extent commented, the ROM test renamed, and the layout path and golden provenance recorded in `server/test/fixture/synthetic/README.md`.
- Round 2: Claude APPROVE, 8. No blocking problem. Its five open minor items were handled: the ROM-null comments reworded, the test title names the label rule, the layout and provenance written to the README. Declined: a ROM-null decode test (no decoder reads ROM tables yet) and enforcing `verified` rules in `assertGolden` (the later coverage guard ticket). Two minor problems declined.
- Gemini and GPT: not run.

## Test state

- 20 new tests pass. Typecheck and `biome ci` are clean.
- The full server suite has one failure that predates this work: `core.test.ts` wants Lua 5.3 or 5.4 and this machine has 5.5.
