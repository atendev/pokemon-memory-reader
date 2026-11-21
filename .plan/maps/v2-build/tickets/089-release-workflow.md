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
