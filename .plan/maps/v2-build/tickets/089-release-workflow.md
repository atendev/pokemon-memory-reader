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

## Handoff

Branch `t3/release-yml-per-os-archives`. Audit round: 0 (no council run yet). Council seats: Claude only (Gemini and GPT are out of quota). Tag: `wfm-v2-build-089-1795265782`.

**Done (committed as `wip:`)**
- `scripts/check-release-ref.ts` and test: rule table from amendment 024 (stable from main only, prerelease from main or `PRERELEASE_BRANCH`, version match, missing branch fails, stable fails while the constant is set), `body` command (changelog section, link lint, `scripts/release-notes.md` user notes, dry-run placeholder). No earlier ticket built this script, so it is part of this ticket.
- `scripts/release-archive.ts` and test: six-target table, archive names, deterministic zip writer (exec bit kept), GNU tar.gz, `bridges`, `sums`.
- `.github/workflows/release.yml`: jobs `ref`, `build` (6 targets, macOS ad-hoc codesign), `smoke` (native runners, Rosetta for darwin-x64), `draft`. Tag push creates a draft, `workflow_dispatch` and `pull_request` are dry runs that upload artifacts only. All actions SHA-pinned (upload-artifact v7.0.2, download-artifact v8.0.2 looked up with `gh api`).
- `scripts/release-workflow.test.ts`.

**Left, in order**
1. Fix the one failing test, "the matrices match the target table": Biome reformatted the inline matrix rows in `release.yml` into block style, so the `target: X,` and `runner: Y, ext: Z` string matches break. Match with a YAML-aware parse or a looser regex.
2. `bun run lint`, `bun run typecheck` and `bun test` pass except that test. Rerun all three.
3. Run the council (Claude seat only) on the diff, up to five rounds.
4. Write `.plan/maps/v2-build/assets/089-release-workflow-report.md`, run unslop, commit.
5. Run the Timing close (`wf-time.py close --slug v2-build --ticket 089 --name 'release.yml and per-OS archives' --ticket-file <file>`), delete this section, add `## Answer`, commit, push without force, open a PR against `wayfinder/v2-build-master` and link it.

**Open points for the report**
- Surfaced candidates: the coverage guard's tier 2 and no-fixture list isn't pasted into the draft body (the guard doesn't exist yet). README SmartScreen text and `CHANGELOG.md` don't exist. `windows-11-arm` with `setup-bun` and Rosetta steps are unverified. GitHub only offers `workflow_dispatch` for default-branch workflows, so the `pull_request` trigger proves the dry run. `codesign --force` was added to the spec's `codesign --sign -`.

**Read first:** `.github/workflows/release.yml`, `scripts/check-release-ref.ts`, `scripts/release-archive.ts`, `scripts/release-workflow.test.ts`.
