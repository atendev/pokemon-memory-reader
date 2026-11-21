---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T13:30:00Z
---

# npm publishing workflow for the API package

## What to build

Spec §13.8 and §10. A workflow that publishes `@pokemon-memory-reader/api` from `api-v*` tags, checked by the same ref rules as the app release. Build on the existing `api-package` CI job (`publint`, `attw`, the packed-tarball check without `zod`). It must support a dry run on `workflow_dispatch` that runs `npm publish --dry-run` and never publishes.

## Acceptance criteria

- The dry run succeeds on the branch and shows the file list and exports map.
- A real publish step exists but runs only on a matching tag, and its secret is read from the repository, never printed.
- The workflow refuses a stable `api-v2.0.0` tag from any ref but main.

## Answer

`.github/workflows/release-api.yml` has three jobs. `ref` runs `check-release-ref.ts check --kind api`, so a stable `api-v2.0.0` passes from main only and a prerelease from main or `PRERELEASE_BRANCH`. `package` builds and packs the API, runs `publint`, `attw` and the consumer smoke (the `ci.yml` `api-package` checks), builds the release body from `api/CHANGELOG.md` before anything ships, and runs `npm publish --dry-run` plus a `jq .exports` step so the file list and exports map show in the log. `publish` runs on a tag push only and publishes the checked tarball with `--provenance`, to `next` for a prerelease and `latest` for a stable version, then creates the GitHub release. `workflow_dispatch` and a path-filtered `pull_request` are dry runs.

Deviation from the acceptance text: there is no repository secret. Spec §13.8 requires npm trusted publishing through OIDC with no long-lived token, so the publish job holds `id-token: write` and a test asserts no `secrets.` or token variable appears. `api/package.json` and `bun.lock` moved from `0.0.0` to `2.0.0-alpha.0` so the branch dry run passes the ref check. Tarball paths need `./pack/` because npm reads `pack/x.tgz` as a git shorthand.

Report: [090 report](../assets/090-npm-publishing-workflow-report.md). Audit: APPROVE in round 2, Claude seat only (Gemini and GPT: not run). CI not run here, the master runs the dry run on the merged batch. The owner steps (claim the npm org, publish the `0.0.0` placeholder, register the trusted publisher for `release-api.yml`) wait in a surfaced ticket.

Timing: wall 5m, active 5m, user 0s, wait 0s, blocked 0s | implement 1m, audit 1m (1 round), fix 1m | tools 38 (5 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 101k | cost $1.13 sonnet-5-5 + $0.02 haiku-5-5
