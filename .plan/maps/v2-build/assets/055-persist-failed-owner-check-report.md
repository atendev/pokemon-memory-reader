# Persist a failed owner check so the release gate blocks the repo: decision report

Ticket: [Persist a failed owner check so the release gate blocks the repo](../tickets/055-persist-failed-owner-check.md). Built on branch `t3/persist-failed-owner-check`. Audit: APPROVE in round 3, with gemini 10, gpt 9 and claude 8. No grilling or research subagents ran.

## Decisions

1. **Where the failure record lives.**
   - Question: where does a failed owner check persist?
   - Options: a second file next to the ledger, or failure rows inside the ledger.
   - Choice: a new committed file, `scripts/generate-profiles/signature-failures.json`, starting as `[]`. Each row is `{ profileId, repo, sha1, date }`. The ledger keeps its `{ profileId, sha1, date }` shape and stays append-only with the first entry kept, so the generator and its rating logic are untouched. Rows carry `repo` so the gate doesn't depend on the profile still being shipped.
   - Made by: main thread.

2. **How the gate blocks.**
   - `releaseGateProblems` takes the failures as a new third argument, required, so a caller can't forget it. For every shipped profile whose pret repo has a failure row, it adds one problem: `<id> is blocked: the owner check failed for <profiles> and no later pass has cleared it`.
   - Round 1 passed only the signed profiles. The claude seat raised that as blocking, because amendment 022 item 7 and the ticket say every profile of the repo. The gate now checks every shipped profile, signed or not. A test with an unsigned profile covers it, and mutating the gate back to signed profiles makes it fail.
   - A failure in a repo no shipped profile comes from blocks nothing.
   - Made by: main thread. Fixed after the claude seat's round 1 problem.

3. **Which failures are persisted.**
   - Question: does every failed check write a row?
   - Choice: only a signature mismatch on a ROM whose SHA-1 the profile lists. That is a mapping fault, which is what item 7 blocks on. A wrong file or an unreadable file still fails the run and blocks the run's own repo, as in ticket 038, but writes no row and prints `not recorded`. No later pass could ever name such a ROM's SHA-1, so a persisted row would never clear.
   - Made by: main thread.

4. **What clears a block.**
   - A pass for the same profile and SHA-1 removes the matching row. A second identical failing run writes nothing, because a repeat keeps the first row. A second identical passing run changes neither file.
   - A pass clears its own row even when another profile in the same repo fails in the same run. The sibling's new row keeps the repo blocked, and the pass is still kept out of the ledger, as in ticket 038. In round 2 the gpt seat raised this as blocking, because the first version skipped the clear for a failed repo. Fixed in round 3.
   - A pass for another ROM or another profile leaves the row in place.
   - Made by: main thread. Fixed after the gpt seat's round 2 problem.

5. **Repo-less profiles.** In round 1 gemini, and in round 2 claude, noted that a failure with an empty repo would block every profile with no repo. Fixed: an empty repo names no group, so such a failure blocks only its own profile. A test covers it.
   - Made by: main thread. Raised by two seats.

6. **`--record` output.** A changed failure file prints `failure record updated. Commit scripts/generate-profiles/signature-failures.json.` The line comes before the existing ledger line, so the last line stays `ledger updated` or `ledger unchanged`. A run without `--record` writes neither file. `run` takes a required `failuresPath` option, so a caller can't skip the record by omission.
   - Made by: main thread.

## Audit

- Round 1: gemini APPROVE 9, gpt APPROVE 9, claude DISAPPROVE 6.
  - Claude problem 1 (blocking): the gate skipped unsigned profiles of the repo. Fixed, decision 2.
  - Gemini problem 1 (minor): empty repo accepted. Declined in round 2, then fixed after claude raised it too, decision 5.
- Round 2: gemini APPROVE 10, gpt DISAPPROVE 6, claude APPROVE 8.
  - Gpt problem 1 (blocking): a pass in a repo that failed again didn't clear its own row. Fixed, decision 4.
  - Claude problem 1 (minor): the same empty-repo defect. Fixed, decision 5.
- Round 3: gemini APPROVE 10, gpt APPROVE 9, claude APPROVE 8.
  - Claude problem 1 (minor, declined): the run-level `blocked` line and the ledger skip still group repo-less profiles together. Reason: ticket 038 decision 3 declined this edge and the gate does not read it. Every profile the generator writes has a repo.

## Evidence

- `bun test scripts`: 192 pass, 0 fail. New tests cover the failure parser, repeat and clear rules, the gate for a sibling revision, the failed profile itself, an unsigned profile, a repo-less profile and an unrelated repo, and `run` for write, no write without `--record`, no diff on a repeat, clear on a later pass with a repeat run, a pass for another ROM or profile, a pass beside a failing sibling, and a wrong file.
- All ROMs in tests are made-up bytes built in the test. No ROM bytes are committed.
- `bun run lint` and `bun run typecheck` pass.
- Mutation check: passing only signed profiles to `failureProblems` fails the unsigned-profile gate test.

## Skipped

- The Jev audit, as the brief instructs.
- Renaming the thread.
- Leaving `map.md` alone, as the brief instructs. The master adds the Decisions line.

## Surfaced

- None.
