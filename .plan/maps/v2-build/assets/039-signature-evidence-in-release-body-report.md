# Put `SIGNATURE-EVIDENCE.md` into the draft release body: decision report

Ticket: [Put `SIGNATURE-EVIDENCE.md` into the draft release body](../tickets/039-signature-evidence-in-release-body.md). Built on branch `t3/signature-evidence-release-body`. Audit: APPROVE in round 2 (haiku auditor). Round 1 raised three problems: the missing `release.yml` wiring (accepted as scoped), a body that could get the section twice, and a heading-only file passing the check.

## Decisions

1. **What can be built while `release.yml` doesn't exist.**
   - Question: the ticket says the release workflow's body step includes the notes file, but neither `release.yml` nor `scripts/check-release-ref.ts` is in the repo.
   - Options: write a whole `release.yml` for one step, or build the body step as a script the workflow will call.
   - Choice: `scripts/release-body.ts <body-file> [evidence-file]`. It appends `server/src/profile/builtin/SIGNATURE-EVIDENCE.md` to the body file that `release.yml` hands to `gh release create --notes-file`. The call in `release.yml`, placed after the ref check, waits for the workflow ticket.
   - Made by: main thread. Auditor raised the missing wiring in round 1 and accepted the scoping.

2. **How a missing or damaged file fails.**
   - The script reads the notes file before it touches the body. A missing file throws `SIGNATURE-EVIDENCE.md is missing at <path>. Run \`bun run generate:profiles\` and commit the result.` and the CLI exits 1.
   - A file that doesn't start with `### Signature evidence`, or holds only that heading, fails the same way. This catches an empty or truncated commit.
   - Made by: main thread. The heading-only case came from the auditor in round 1.

3. **Running the step twice.**
   - Appending a second time would double the section. `withSignatureEvidence` throws when the body already has the heading, and the body file stays as it was.
   - Made by: auditor's objection, fixed by the main thread.

4. **How it is tested without GitHub.** `scripts/release-body.test.ts` runs in the default suite. It covers the committed file, the missing file, a bad heading, a heading-only file, the append, the double run, a missing body file, a missing notes file through the CLI (body untouched), and the usage exit.

## Left out

- The call in `release.yml` and its order after the ref check, because the workflow doesn't exist. It is reported as a surfaced ticket.
- Atomic writes to the body file. The step writes a scratch file in CI, so a partial write only fails that run.
