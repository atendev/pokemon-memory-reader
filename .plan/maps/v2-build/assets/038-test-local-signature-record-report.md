# Build `test:local` with its signature check and `--record` call: decision report

Ticket: [Build `test:local` with its signature check and `--record` call](../tickets/038-test-local-signature-record.md). Built on branch `t3/build-test-local-record`. Audit: APPROVE in round 2. Round 1 scores were gemini 10, gpt 9 and claude 6 (one blocking problem). In round 2 the claude seat re-checked and scored 8. No grilling or research subagents ran.

## Decisions

1. **Where the code lives.**
   - Question: where does `test:local` go, and how do tests reach it?
   - Choice: `scripts/test-local.ts` with `run`, `checkProfile`, `signatureProblems` and `signedProfiles` as plain exports, and a `bun run test:local` script in the root `package.json`. The entry point runs only under `import.meta.main`, like `notices.ts`. Tests call `run` directly with injected profiles, env, ledger path and clock.
   - Made by: main thread.

2. **Which ROM path belongs to which profile.**
   - Question: spec §12.9 says paths come from env vars. Which names?
   - Options: one fixed variable per game family, or one per profile ID.
   - Choice: one per profile, `PMR_ROM_<ID in upper case, non-alphanumerics as _>`, so `emerald-us-1.0` reads `PMR_ROM_EMERALD_US_1_0`. A profile ID is exactly what the ledger keys on, and revisions of one game need different files.
   - Behaviour: unset prints `not run  <id>: <var> is not set` and exits 0. Set but unreadable fails, as §12.9 requires.
   - Made by: main thread.

3. **What counts as a pass.**
   - The ROM's SHA-1 must be in the profile's `identify.sha1`, and every signature word must equal its bytes at `address - 0x08000000`. A ROM too short for a word, or an address outside `0x08000000`..`0x0DFFFFFF`, fails with a message naming the word.
   - Why the SHA-1 check: amendment 022 item 2 gives `owner` only for a ROM whose SHA-1 the profile lists. A pass on some other ROM would write a ledger entry the gate then rejects as stale.
   - Made by: main thread, following the amendment.

4. **Which profiles are checked.** Official profiles that declare signature words. Gen 1-2, hack and Ruby/Sapphire profiles with no signature are skipped, which matches amendment 022 items 1 and 9. The built-in set is read from the JSON files, the way the release gate reads it.
   - Made by: main thread.

5. **What "a failed owner check blocks that repo's profiles" means in this ticket.**
   - Question: item 7 says a failure blocks the release of every profile from the pret repo. What does the script do?
   - Choice: exit code 1, a `FAIL` line with each bad word, a `blocked  <repo>` line, and no ledger entry for any profile of that repo on that run, including a sibling that passed. Other repos still record.
   - Why not more: the ledger holds `{ profileId, sha1, date }` passes only, and the 037 gate reads no failure state. A block that survives the run needs a persisted failure record and a gate rule, which is a change to the 037 design the ticket doesn't ask for. Deleting earlier entries would be wrong as well, because a failure can come from a wrong file, not only a bad generator mapping. `--record` stays append-only.
   - Surfaced: a new ticket for the persistent half (see Surfaced below).
   - Made by: main thread. Raised by the claude seat in round 1 as blocking and rebutted. The seat accepted the rebuttal in round 2 and kept the gap as a minor note.

6. **`--record`.**
   - It calls `recordSignatureCheck` for each passing profile and nothing else. The ledger parser, sorting and the keep-the-first-entry rule are 037's, so a second run with the same inputs, even on a later day, leaves the file byte for byte equal. The script prints `ledger updated. Run bun run generate:profiles and commit the result.` or `ledger unchanged`, because the profile ratings and `SIGNATURE-EVIDENCE.md` only change when the generator reruns.
   - Made by: main thread.

7. **`fixtures-local/`.** Spec §12.9 says local files live in a gitignored `fixtures-local/`, but `.gitignore` didn't list it. It does now.
   - Made by: main thread.

## Audit

- Round 1: gemini APPROVE 10, gpt APPROVE 9, claude DISAPPROVE 6.
  - Claude problem 1 (blocking): a failed check doesn't stop an earlier ledger entry from keeping the `owner` rating. Rebutted as in decision 5.
  - Claude problem 2 (minor): no test for a later failing run against a ledger that already holds a pass. Fixed.
- Round 2 (claude only, since the other two had approved and the change was a test): APPROVE 8, with three minor problems.
  1. The new test passed even without the block, because a repeat of an existing entry is deduplicated anyway. Fixed: the failing repo now also has a passing sibling `b`, which would be appended without the block. I confirmed it with a mutation: with the `!failedRepos.has` check removed, this test and the earlier block test both fail.
  2. The block is per run only. Same gap as decision 5, now a surfaced ticket.
  3. A profile with no `provenance.repo` shares one blocking group with every other such profile. Declined: every profile the generator writes has a repo, and the profile schema is not this ticket's concern.

## Evidence

- `bun test scripts/test-local.test.ts`: 20 tests pass. They cover pass, fail on a wrong word, a short ROM, a non-ROM address, a wrong revision (SHA-1), an unset variable, a missing file, `--record` appending, a second run with no diff, the ledger rating the profile `owner`, a failed check blocking its own repo only, and an unknown argument.
- All ROMs in tests are made-up bytes built in the test. The committed Emerald profile is run with no ROM path and reports `not run`.
- `bun run lint` and `bun run typecheck` pass. `bun test` gives 473 pass and 1 fail, `the Lua core runs under Lua 5.3 or 5.4`. This machine has Lua 5.5 and CI uses 5.4, so it is not related.
- `bun run test:local --record` with nothing set prints the `not run` line, then `ledger unchanged`, and exits 0.
- No ROM bytes are committed.

## Skipped

- The Jev audit, as the brief instructs.
- Renaming the thread.

## Surfaced

- Persist a failed owner check so the release gate blocks the repo. A task, blocked by nothing now that `test:local` exists.
