---
type: task
blocked_by: [009]
claimed_by: wayfinder-master v2-build-master-1794792924
claimed_at: 2026-11-16T03:24:12Z
---

# Tracer viewer and executable

## Question

Ship the tracer as one compiled executable that serves a minimal viewer. Follow the viewer and release pipeline sections of the spec.

- A React viewer built by Bun with a single Party screen. It reads `/api/v2/party` and `status` through the API package's client and shows six cards with name fallbacks, no icons. It applies the `apple` skill's sizing rules where the viewer design leaves them open.
- The viewer is embedded in the server, and `bun build --compile` produces the executable.
- `scripts/smoke.ts` (version check, starts, serves `status`) runs in CI against a linux-x64 build. Turn on the compile smoke job in `ci.yml`.
- The executable writes the mGBA bridge into the data folder and serves it at `/bridges/mgba.lua`.

## Acceptance

- The CI compile smoke is green.
- Running the executable locally serves the viewer, which shows the no-game state.

## Handoff

Branch `t3/tracer-viewer-executable`. Audit round 0 done (no auditor started yet). Tag `wfm-v2-build-010-1794792924`.

**Done (all in the wip commit):** `api/src/client.ts` gained `get`/`getStatus`/`getParty`/`PmrApiError` with tests. Viewer React app in `viewer/src/` (index.html, main.tsx, App, EmptyState, PartyScreen, display.ts, useResource.ts polling, styles.css plain CSS on the apple skill's dark palette, 20 tests). `bridges/src/build.ts` now imports `core.lua` and `mgba-shim.lua` as text (compile-safe), with `bridges/src/lua.d.ts`. Server: `main.ts`, `cli.ts`, `data-folder.ts`, `bridges.ts`, `build-info.ts`, `consoleLog`, `/bridges/:file.lua` route in `app.ts`, `viewer` and `bridges` options on `startServer`. `bun run typecheck` and `biome ci` pass. `bun test`: only the known Lua 5.5 version test fails. A local `bun build --compile` exe starts, serves `/`, `/api/v2/status` (disconnected), `/bridges/mgba.lua`, writes the data folder, exits cleanly on SIGTERM.

**Left, in order:**
1. `scripts/smoke.ts <exe> <version>` per spec §13.3 (mgba.lua only, bizhawk.lua is not built yet; SIGTERM exit 0; free port; temp `--data-dir`).
2. `ci.yml`: remove `if: false` from `compile-smoke`, add `--define 'PMR_TARGET="linux-x64-baseline"'` and `PMR_COMMIT`, update the comment. Add a root script `build:exe`.
3. Tests: `cli.test.ts` (parseArgs, exit-2 cases), `data-folder.test.ts` (default folders per OS, installBridges rewrite-only-on-change), app test for `/bridges/mgba.lua` (200, unknown name 404, no path traversal), `main` port-in-use exits 1 with no TTY (spawn `bun server/src/main.ts`), version line.
4. Audit with a new haiku auditor (limits per skill), up to 5 rounds.
5. Decision report `.plan/maps/v2-build/assets/010-tracer-viewer-and-executable-report.md`, unslop it, commit, push (no force), PR against `wayfinder/v2-build-master` if the repo uses PRs, return PUSHED.

**Decisions to put in the report:** plain CSS instead of Tailwind (bun-plugin-tailwind under `--compile` untested; Tailwind goes to the full viewer ticket); viewer polls every 1 s until SSE exists; party polled only when `status.state === "game"`; mGBA adapter fixed live on 127.0.0.1:7426 until config/selector tickets; no config.json yet (flags only); install steps without a data-folder path because no route exposes it (ticket 021); only `mgba.lua` bridge since `bizhawk.lua` doesn't exist; `PmrApiError.status` holds the status resource, `httpStatus` the HTTP code.

**Surfaced candidates:** adopt Tailwind in the viewer; smoke checks `bizhawk.lua` once that bridge exists.

**Read first:** `server/src/main.ts`, `server/src/app/app.ts`, `viewer/src/App.tsx`, `ci.yml`.
