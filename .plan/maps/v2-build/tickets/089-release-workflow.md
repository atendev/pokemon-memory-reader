---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T13:05:00Z
---

# `release.yml` and per-OS archives

## What to build

Spec §13.1, §13.4, §13.6 and §13.7, with [the prerelease amendment](../assets/024-prereleases-without-main.md). The workflow runs the shared ref check, `bun run notices`, `bun build --compile` for each target, builds the per-OS archives, builds the LGPL source archives and body with `scripts/lgpl-sources.ts` (`build`, `body`, `check --online`, per [the LGPL ticket](./049-lgpl-release-check-assets.md)), calls `scripts/release-body.ts` after the ref check ([039](./039-signature-evidence-in-release-body.md)), and creates a draft release. This ticket doesn't create a tag or publish anything.

Make it runnable on `workflow_dispatch` against the feature branch in a mode that builds and uploads artifacts but never publishes, so CI can prove it without a tag.

## Acceptance criteria

- A `workflow_dispatch` dry run on the branch builds every target and the archives, and attaches them as workflow artifacts only.
- The ref check refuses a stable tag from any branch but main, and refuses a prerelease tag from any ref but main or `PRERELEASE_BRANCH`.
- The draft release body includes the signature evidence and the LGPL lines.
- Every third-party action is SHA-pinned like `ci.yml`.

## Answer

`.github/workflows/release.yml` has four jobs. `ref` runs the shared ref check (`scripts/check-release-ref.ts check`). `build` compiles all six targets with `bun build --compile` after `bun run notices`, ad-hoc signs the macOS binaries, and builds the per-OS archive with `scripts/release-archive.ts`. `smoke` unpacks each archive on a native runner and runs `scripts/smoke.ts` (`darwin-x64` runs under Rosetta). `draft` adds the bridges, builds the LGPL source archives with `scripts/lgpl-sources.ts build`, writes `SHA256SUMS`, builds the body (`check-release-ref.ts body`, then `release-body.ts`, then `lgpl-sources.ts body`) and creates a draft with `gh release create --draft`. A tag push is the only trigger that creates a draft. `workflow_dispatch` and `pull_request` (filtered to release-shaping files) are dry runs that upload the archives, `body.md`, `SHA256SUMS` and the bridges as workflow artifacts and never publish. GitHub offers `workflow_dispatch` only for a workflow on the default branch, so `pull_request` proves the dry run from a feature branch. Every action is SHA-pinned.

`check-release-ref.ts` had no earlier ticket, so this ticket built it. It enforces the 024 rules. A stable tag passes from `main` only, a prerelease tag from `main` or `PRERELEASE_BRANCH`, the tag must match the package version, and a stable tag fails while the constant is set. `release-archive.ts` holds the six-target table, the archive names, deterministic zip and GNU tar.gz writers, `bridges` and `sums`. The `sums` step skips names `lgpl-sources.ts build` already listed, because the Bun and tinycc source archives are `.tar.gz`.

Excluded: the coverage guard's tier 2 list in the body (the guard doesn't exist), README SmartScreen text and `CHANGELOG.md` (neither exists). Unverified until the first run: `windows-11-arm` with `setup-bun`, and the Rosetta step.

Report: [089 report](../assets/089-release-workflow-report.md). Audit: APPROVE in round 2, Claude seat only (Gemini and GPT: not run). CI not run here, the master runs the dry run on the merged batch.

Timing: wall 11m, active 10m, user 0s, wait 0s, blocked 0s | implement 6m, audit 3m (2 rounds) | tools 76 (10 subagent) | limits 0, compactions 0, handoffs 1 | ctx peak 165k | cost $2.66 sonnet-5-5 + $0.03 haiku-5-5
