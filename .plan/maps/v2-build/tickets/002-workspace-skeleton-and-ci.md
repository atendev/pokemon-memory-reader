---
type: task
blocked_by: []
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
