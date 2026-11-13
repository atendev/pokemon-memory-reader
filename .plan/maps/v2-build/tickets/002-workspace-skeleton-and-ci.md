---
type: task
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794555906
claimed_at: 2026-11-13T07:45:06Z
---

# Workspace skeleton and CI

## Question

Turn the repo into the v2 Bun workspace and give it CI. wayfinder-master watches CI on every child branch, so every later ticket depends on this one.

- Tag `v1-lua` at `main`'s current HEAD and push the tag. Then delete the v1 Lua tree on this branch (`main.lua`, `core/`, `readers/`, `modules/`, `network/`, `formatting/`, `utils/`, `commands/`, `debug/`, `data/`, `squish.bat`, `squishy`, `launc-dev.ps1`, and v1-only assets). Keep `.plan/`, `CONTEXT.md`, `LICENSE`, and `.impeccable` if the viewer design still uses it. Replace `README.md` with a short v2-in-progress note that points at the `v1-lua` tag.
- Create the Bun workspaces `server/`, `viewer/`, `api/`, `internal/` and `bridges/`. Each gets a placeholder module and one passing test. Pin the exact Bun version in the root `package.json` and commit `bun.lock`.
- Set up strict `tsc --noEmit` across the workspaces and Biome for lint and format.
- Add `.github/workflows/ci.yml` as the release pipeline decision describes: push and pull request triggers, a frozen install, Biome, `tsc`, and `bun test`, with actions pinned by commit SHA. Leave the API package check and the compile smoke as jobs that are commented out or skipped, each with a note naming the ticket that turns it on.
- Set the license headers and `package.json` license fields from the License decision: GPL-3.0-or-later for the app, MIT for `api/`.

## Acceptance

- CI is green on the pushed branch.
- `bun install --frozen-lockfile && bun run lint && bun run typecheck && bun test` passes locally from a clean clone.
- The `v1-lua` tag exists on the remote and points at `main`'s HEAD.

## Answer

The repo is now a Bun 1.4.2 workspace with `server/`, `viewer/`, `api/`, `internal/` and `bridges/`, and `ci.yml` runs lint, typecheck and tests on every branch push and pull request. CI run 43389823032 passed on `222f42c`. The `v1-lua` tag is on the remote at `064d0a4`, `main`'s HEAD, and the v1 Lua tree is gone from this branch.

- **Toolchain.** `packageManager: bun@1.4.2` pins Bun, and setup-bun reads it. Dev tools are exact: Biome 2.6.7, TypeScript 7.0.2 (the native compiler) and `@types/bun` 1.4.2. `bun.lock` is committed.
- **Typecheck.** Each workspace runs `tsc --noEmit` against a strict root `tsconfig.json`, called through `bun run --workspaces typecheck`. The root config maps `@pokemon-memory-reader/api/*` to `api/src/*.ts`, and every workspace config extends it.
- **Placeholders.** `api/src/client.ts` exports `API_VERSION` and `API_BASE_PATH`. `server/src/version.ts` exports `APP_VERSION` from `server/package.json`, which is `2.0.0-alpha.0`. The other three workspaces hold a neutral `placeholder.ts`. Each workspace has a passing test, and the server test checks the API alias.
- **CI.** Actions are pinned by SHA, and Dependabot updates them weekly. The API package check and the compile smoke are `if: false` jobs. The compile smoke names "Tracer viewer and executable". The API package check names the new ticket "API package build and check".
- **Licenses.** The app packages are `GPL-3.0-or-later`, `api/` is `MIT` with its own `LICENSE`, and the root has `LICENSE` and `NOTICE` with no per-file headers. `NOTICE` has no pret or CFRU credit yet. The Emerald profile and generator ticket adds the pret credit with the first generated profile.
- **Deferred to "API package build and check".** The dist `exports` map, the `api/` build, `files`, `types.ts` and `schemas.ts`. A source-path `exports` map would break the Importable package decision. This deferral was the auditor's condition for approval.

Excluded: Bun 1.4.4 (upgrades go through a PR with the release smoke matrix), one root `tsc` program for all workspaces, commented-out CI jobs, and running CI on tag pushes.

Decision report: [assets/002-workspace-skeleton-and-ci-report.md](../assets/002-workspace-skeleton-and-ci-report.md).
