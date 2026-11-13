# Workspace skeleton and CI: decision report

Ticket: [Workspace skeleton and CI](../tickets/002-workspace-skeleton-and-ci.md). Branch `t3/workspace-skeleton-ci`. The main thread implemented the ticket as a child of wayfinder-master. A haiku auditor reviewed it. Every decision below is the implementer's unless the "Who" line says otherwise.

The repo has no `workflow.md`, `AGENTS.md` or `CLAUDE.md` of its own, so the wayfinder-runner steps apply with the master's overrides. The commit gate committed without asking the user, the branch was pushed for the master to watch CI, and `map.md` was left alone.

## v1 removal

**Tag `v1-lua`.** The options were a lightweight tag or an annotated tag. I chose an annotated tag at `064d0a4`, which is `main`'s HEAD and `v1.2.0`. It is pushed, `git ls-remote` shows it peels to `064d0a4`, and `git diff --quiet v1-lua origin/main` passes.

**Delete the v1 tree.** The ticket's list was removed: `main.lua`, `core/`, `readers/`, `modules/`, `network/`, `formatting/`, `utils/`, `commands/`, `debug/`, `data/`, `squish.bat`, `squishy`, `launc-dev.ps1`, and `assets/example_frontend.png`, the only v1 asset. The shell guard held the `git rm`, and the user chose "Run it".

**What stays.** `.plan/`, `CONTEXT.md` and `LICENSE` stay. The repo has no `.impeccable`. I kept `.vscode/settings.json` because its Lua 5.4 runtime and BizHawk globals still help when writing the bridge shims. Biome skips it.

**README.** The README is a short v2-in-progress note. It links the `v1-lua` tag and the releases page, says v1 was released under the GPL-3.0 text in its `LICENSE` file, lists the dev commands, gives the license split and carries the non-affiliation notice.

## Toolchain

**Bun version.** The options were 1.4.2, which the owner runs and which the Language and Release pipeline decisions tested, or 1.4.4, the latest release. I chose 1.4.2. A Bun upgrade goes through its own PR with the release smoke matrix, as the Release pipeline decision says.

**Where the pin lives.** The options were `packageManager`, `engines.bun` or a `.bun-version` file. I chose `"packageManager": "bun@1.4.2"`. CI passes `bun-version-file: package.json`, and setup-bun v2.2.0 reads `packageManager` first (`src/utils.ts:124`).

**TypeScript.** The options were TypeScript 5.x or 6.x, or 7.0.2, the current release and the native compiler. I chose 7.0.2. It typechecks all five workspaces and catches errors. TypeScript 7 has no JavaScript compiler API, so a tool that needs `typescript` as a peer could break. attw ships its own TypeScript, so the API package check isn't affected.

**`@types/bun`.** I pinned it to 1.4.2 to match the runtime, not 1.4.4. Biome is 2.6.7. All dev tools are exact versions in the root `package.json`.

## TypeScript layout

**One program or one per workspace.** The options were one root `tsc` run over everything, or `tsc --noEmit` in each workspace. I chose one per workspace, run by `bun run --workspaces typecheck`. Each workspace keeps its own libraries this way: the viewer gets DOM, and `api/` targets ES2022 like its build will. A deliberate type error in `internal/` made the script exit 1.

**Root `tsconfig.json`.** It sets `strict` plus `noUncheckedIndexedAccess`, `noImplicitOverride` and `noFallthroughCasesInSwitch`, with `module: Preserve`, bundler resolution, `verbatimModuleSyntax` and `types: ["bun"]`. `files: []` keeps a bare `tsc` at the root from checking everything. All five workspace configs extend it. I left out `exactOptionalPropertyTypes` to avoid friction with library types.

**API alias.** One wildcard path maps `@pokemon-memory-reader/api/*` to `./api/src/*.ts`, as the Importable package decision describes. The bare package name has no mapping yet because `api/` has no index module. When I pointed `server/tsconfig.json` at a config without the alias, `bun test server` failed with "Cannot find module '@pokemon-memory-reader/api/client'". The server test does exercise the alias.

**api `exports` map.** The auditor asked for an `exports` map and placeholder `types.ts` and `schemas.ts` (round 1). The Importable package decision points the published `exports` only at `dist/` and excludes export conditions for workspace source, so a source-path map would break it. The dist map, the build, `files`, `types.ts` and `schemas.ts` move to the surfaced ticket "API package build and check". Who: auditor raised it, implementer deferred it, auditor's round 2 verdict is below.

## Workspaces and placeholders

**Placeholder modules.** Where a decision already fixes the content, the placeholder uses it. `api/src/client.ts` exports `API_VERSION` (2) and `API_BASE_PATH` (`/api/v2`). `server/src/version.ts` exports `APP_VERSION` from `server/package.json`. `viewer/`, `internal/` and `bridges/` each export a neutral `workspace` string from `src/placeholder.ts`, so I don't pre-decide anything the Core module interfaces ticket owns. Every workspace has one passing test, six tests in all.

**Versions.** `server/package.json` is `2.0.0-alpha.0`, a semver prerelease below the first planned tag `v2.0.0-beta.1`. `api/package.json` is `0.0.0`, matching the placeholder the npm wizard publishes. The other workspaces are private and have no version.

**Dependencies.** `server/` and `viewer/` depend on `@pokemon-memory-reader/api` through `workspace:*`, as the Importable package decision says. Nothing depends on `internal/` yet.

## Lint and format

**Biome config.** The config uses space indentation, organized imports, the git ignore file, and the default recommended rules. Biome 2.6 deprecated the `recommended` field, so I dropped it. `.plan/` and `.vscode/` are excluded. Biome 2.6 formats Markdown, so `README.md` and `CONTEXT.md` are checked. `CONTEXT.md` already passes. A later edit that breaks Markdown formatting turns CI red until `bun run format` runs.

**Scripts.** `bun run lint` runs `biome ci .`, which is read-only and the same locally and in CI. `bun run format` runs `biome check --write .`.

## CI

**Triggers.** `ci.yml` runs on pushes to any branch and on pull requests. Tag pushes don't trigger it, so `v*` and `api-v*` tags only start their release workflows. Runs on the same ref cancel each other. The workflow has `contents: read` and checks out with `persist-credentials: false`.

**Check job.** It runs a frozen install, `bun run lint`, `bun run typecheck` and `bun test`. actions/checkout is pinned at v7.0.1 (`3d3c42e5`) and setup-bun at v2.2.0 (`0c5077e5`). Both SHAs came from `gh api repos/<repo>/commits/<tag>`.

**Disabled jobs.** The options were comments or `if: false`. I chose `if: false`, so both jobs show as skipped on every run and stay valid YAML. `api-package` names "API package build and check". `compile-smoke` names "Tracer viewer and executable". Its entry point `server/src/main.ts` is a guess that the tracer ticket corrects.

**API package check ticket.** No ticket turns that job on, so I surfaced "API package build and check". It covers the `api/` tsc build to `dist/`, the dist `exports` map, `files`, pinned `publint` and `attw`, and enabling the job.

**Dependabot.** `.github/dependabot.yml` updates GitHub Actions weekly. Bun and npm packages aren't covered, because the decision only asks for action updates.

## License

**SPDX fields.** The root, `server/`, `viewer/`, `internal/` and `bridges/` are `GPL-3.0-or-later`. `api/` is `MIT` with its own `api/LICENSE`. Source files have no headers, as the License decision says.

**NOTICE.** The root `NOTICE` gives the copyright, the GPL-3.0-or-later grant, the MIT exception for `api/` and the non-affiliation notice. Credits for pret and CFRU are not in it yet, because no pret or CFRU data is in the repo. The Emerald profile and generator ticket should add the pret credit with the first generated profile.

**Copyright holder.** "Nathan Beene" comes from the v1 commit history. The years are 2025 to 2026 in `NOTICE`, since v1 started in 2025, and 2026 in `api/LICENSE`, since the package is new.

## Ignore rules

**Old entries.** `examples/`, `docs/`, `builds/` and `Bizhawk/` were v1 local folders. None of them exists in the owner's main checkout, and ignoring `docs/` would hide v2 docs, so they're gone.

**ROMs, saves and outputs.** Round 1 of the audit found gaps in the ROM and savestate patterns. Who: auditor. The fix ignores `.gb`, `.gbc`, `.gba`, `.zip`, `.7z`, `.sav`, `.srm`, `.ss0` to `.ss9`, `.state`, `.state0` to `.state9`, `.state.auto` and `.dmp` in any letter case, plus `out/`, `pack/`, `dist/`, `coverage/`, `.tgz` and `.agent-state.md`. A temp folder with sample names for each pattern showed nothing untracked, and a `.bin` fixture stayed visible.

## Blast radius

The change is safe because v1 survives intact at `v1-lua`. `git diff --quiet v1-lua origin/main` passed, so the tag tree equals `main`. Other checks:

- `git grep` outside `.plan/` finds no reference to a deleted path.
- The sibling branch `t3/v2-consolidated-spec` changes nothing outside `.plan/`, so the deletions can't conflict with it.
- `bun.lock` has the linux-x64 binaries for Biome and TypeScript, so the frozen install works on `ubuntu-latest`.
- The acceptance chain `bun install --frozen-lockfile && bun run lint && bun run typecheck && bun test` exits 0 in a clean copy of the tracked files.

## Audit

Round 1 rejected the change with four problems. Problem 1, the ROM and savestate patterns, was fixed. Problem 2 was split: `out/` and `pack/` are now ignored, and the old v1 entries stay dropped for the reason above. Problem 3 was withdrawn because Biome itself wrote the multi-line `workspaces` array and `biome ci` passes. Problem 4, the `exports` map, was deferred because a source-path map would break the Importable package decision. Round 2 verdict: APPROVE, on the condition that this ticket's Answer records the move of the `exports` map, the build, `files`, `types.ts` and `schemas.ts` to "API package build and check".
