# Paste the coverage guard's lists into the draft release body: decision report

Ticket: [Paste the coverage guard's lists into the draft release body](../tickets/109-release-body-coverage-guard-lists.md). Branch `t3/release-body-coverage-guard-lists`. Audit: the Claude seat only (single mode, haiku), APPROVE at round 1 with a score of 8. Gemini and GPT did not run. Auto mode is on, so the main thread made each decision itself.

## Decisions

1. **What is "the guard's output"?**
   - Options: parse the stdout of `bun scripts/coverage.ts`, call `checkCoverage` from the script, or read the committed `docs/coverage.md`.
   - Choice: read `docs/coverage.md`. It is the generated artifact of the guard, a default-suite test already fails when it is stale, and a file can be missing or damaged in a way the step can detect and test without GitHub. Parsing stdout would couple the body to log wording, and calling the guard inside the script would pull the fixture scan into a release script that only formats text.
   - Made by: main thread. Audit: not contested.

2. **How do the reader and the renderer stay in step?**
   - Options: hard-code the two heading strings in `release-body.ts`, or export them from `server/test/support/coverage-guard.ts` and use them in both places.
   - Choice: export `NO_FIXTURE_HEADING` and `TIER2_GAPS_HEADING` from the guard, use them in `renderCoverage` and in `release-body.ts`. Renaming a heading changes both sides, and the committed-file test fails if the reader no longer finds a section.
   - Made by: main thread.

3. **What counts as damaged?**
   - The file is missing, does not start with `# Fixture coverage`, lacks either section, has an empty section, or has a section that is neither `None.` nor a list of `- ` lines. Each case throws a message that names the path or the section and says to run `bun run coverage` and commit the result.
   - An empty list (`None.`) is valid and prints as `None.` in the body.
   - Made by: main thread.

4. **Body layout.** A `### Fixture coverage` section with two `####` parts, the tier 2 gaps first and the no-fixture profiles second, each with a one-sentence intro. The `Failures` section is left out, because the guard failing already fails the step before the body step runs (decision 6).
   - Made by: main thread.

5. **Failure leaves the body alone, and a second run fails.** The script reads and checks the evidence file and the coverage file before the first write, so a failure writes nothing. `withCoverageLists` throws when the body already has `### Fixture coverage`, matching what 039 did for the evidence section.
   - Made by: main thread, following 039.

6. **Does the `draft` job run the guard?**
   - Options: only call `release-body.ts`, or also run `bun scripts/coverage.ts --check` first.
   - Choice: add a `Coverage guard` step before the body steps. It exits 1 when `docs/coverage.md` is stale or the guard has failures, so the lists in the body match the repo at the tagged commit. The workflow test pins the order.
   - Made by: main thread.

7. **Path filter.** `docs/coverage.md` and `server/test/support/coverage-guard.ts` are added to the `pull_request` filter of `release.yml`, because they now change the body.
   - Made by: main thread.

8. **Tests without GitHub.** `scripts/release-body.test.ts` covers the committed file (every bullet of the page appears in the section), a fixed page with exact expected output, an empty list, a missing file, a file that is not the page, a missing list, an empty section, a damaged section, a list that is the last section, the append, a second run, and the CLI on a missing and a damaged guard output with the body unchanged. `release-workflow.test.ts` pins the guard step before the body steps and checks the dry-run chain gains the new section.
   - Made by: main thread.

## Audit

| Round | Claude verdict | Score | Notes |
| --- | --- | --- | --- |
| 1 | APPROVE | 8 | Four minor problems, all declined |

Declined minor problems:

1. The two intro sentences are fixed text that could drift from the guard. They are release-note wording and the lists carry the data. Left as is.
2. An empty section reports "has no section" and not "damaged". The message names the section and the fix command. Left as is.
3. The duplicate check is a substring match, so changelog text with the same heading blocks the body. The error names the heading, and the changelog is ours. Left as is.
4. One test checks bullets with `toContain`. The exact-output test in the same file compares the whole section. Left as is.

## Checks

`bun test` passes except the known local Lua 5.5 version check in `server/test/bridge/core.test.ts` (1707 pass, 1 fail). `bun run typecheck`, `bun run lint` and `bun scripts/coverage.ts --check` pass.

## Left out

- A CI run of the release workflow. The master runs CI on the merged batch.
- A PR. The repo's batch tickets merge through the master branch, so none was opened.
