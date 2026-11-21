# Decision report: npm publishing workflow for the API package

Auto mode, Claude audit seat only (Gemini and GPT: not run, out of quota).

| # | Question | Options | Choice | Made by |
| --- | --- | --- | --- | --- |
| 1 | How does the workflow authenticate to npm? | A repository `NPM_TOKEN` secret (ticket acceptance 2); npm trusted publishing through GitHub OIDC (spec §13.8) | OIDC with provenance. Spec §13.8 says no long-lived token, so no secret exists to leak. A test asserts the file has no `secrets.`, `NODE_AUTH_TOKEN` or `NPM_TOKEN`, and that `id-token: write` sits on the publish job only. | Implementer. The spec wins over the ticket line. |
| 2 | What name does the file take? | `publish-api.yml`; `release-api.yml` | `release-api.yml`, the name §13.8 gives and the one the npm trusted publisher is configured for. | Implementer |
| 3 | How does the dry run work on a branch? | Skip the ref check; keep it | Same shape as `release.yml`: `workflow_dispatch` plus a path-filtered `pull_request`, `check --dry-run`, then `npm publish --dry-run` and a `tar | jq .exports` step. | Implementer |
| 4 | The branch version is `0.0.0`, a stable version, so the ref check fails while `PRERELEASE_BRANCH` is set. What changes? | Bump `api/package.json`; relax the script for dry runs | Bump `api/package.json` and `bun.lock` to `2.0.0-alpha.0`, matching `server/package.json`. The script stays as ticket 089 built it. Amendment 024 already has the bump land before a tag. The `0.0.0` npm placeholder is owner-published and not tied to the repo version. | Implementer |
| 5 | Which dist-tag? | Always `latest`; by prerelease flag | `next` for a prerelease, `latest` for a stable version (§13.8). | Spec |
| 6 | Which npm version? | Runner default; pinned | `npm@11.5.1` installed in both jobs, because older npm and `bun publish` can't publish through OIDC. | Spec |
| 7 | How is the tarball passed to npm? | `pack/*.tgz`; `./pack/*.tgz` | `./pack/*.tgz`. Plain `pack/x.tgz` is read as a git shorthand and fails with `EALLOWGIT`, found by running it locally. | Implementer, from a local run |
| 8 | Publish the checked tarball or rebuild? | Rebuild in the publish job; upload and download | The package job uploads the tarball it checked, and the publish job downloads and publishes that file. | Implementer |
| 9 | Where does the GitHub release body come from? | Skip; build in the publish job; build before publish | `check-release-ref.ts body --kind api` runs in the package job with `api/release-notes.md` (the app notes have SmartScreen text). A missing `api/CHANGELOG.md` section fails the run before anything is published. A test runs the script for a real and a dry run. | Implementer |
| 10 | Copy the `api-package` checks or reuse the job? | Reuse through `workflow_call`; copy | Copy the three checks. A test asserts both workflows carry the same three commands. | Implementer |

## Audit

Round 1: Claude seat DISAPPROVE 5. Two blocking problems misread the body step (it does use the changelog) and were rebutted with the script's behavior. One blocking problem asked for a GitHub run, which this child may not start. Round 2 after a stronger test and the `bun.lock` update: APPROVE 8, four minor problems.

Declined minors:
- No GitHub run yet. The master runs CI on the merged batch. Locally the pack, `npm publish --dry-run` file list and exports map were run (npm 12.2.2, not 11.5.1).
- Copied package checks can drift. The matching-commands test covers the commands.
- No `wizard.sh` for the trusted publisher. §13.8 puts it in the first-time-setup wizard, surfaced as a ticket.
- Main-passes test uses `prereleaseBranch: null`. The shipped constant makes every stable tag fail until the final release ticket deletes it, and `check-release-ref.test.ts` covers that case.

Unrelated failure: `core.test.ts` expects Lua 5.3 or 5.4 and this machine's `lua` is 5.5.
