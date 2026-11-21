---
type: task
blocked_by: [073]
claimed_by: wfm-v2-build-master-1795260524
claimed_at: 2026-11-21T11:40:00Z
---

# `/settings` and `/about` routes

## What to build

Spec §9.5 and [the 021 amendment](../assets/021-viewer-control-routes.md). `GET /settings` shows endpoints, `pollHz` and `updateCheck`, and gains `paths`, which is null for LAN readers. `/about` and `/about/third-party-notices.txt` serve the version, the notices file that `bun run notices` writes (embedded in the executable) and the JavaScriptCore and tinycc copyright lines from [the LGPL ticket](./048-lgpl-notices-about-relinking.md). `--debug` adds `/debug/read` behind a Host check. The shared write guard, the debug Host check and the route-table test come from 021, and internal error codes are a closed enum.

## Acceptance criteria

- Each route is covered by the route-table test, with its guard and error codes.
- `paths` is null for a LAN reader and filled for loopback.
- The compiled executable serves the notices file and the About lines (the compile smoke covers it).
- `--debug` routes are absent without the flag.

## Handoff

Branch `t3/settings-about-routes`. Implementation is written, typechecks and the existing api and cli tests pass. No new tests yet, no audit run (round 0 of 5), no decision report.

**Done (uncommitted before this commit):**
- `internal/src/`: `errors.ts` (closed 18-code enum, status map, `internalErrorBody`), `about.ts`, `debug.ts`, `settings-route.ts` (Zod bodies).
- `server/src/app/guards.ts` (write guard, debug guard, `internalError`, `peerAddress`), `route-table.ts` (`ROUTES`, `guardOf`), `app.ts` (`internalRoute`, CORS scoped to `/api/v2/*`, `/settings` GET+PUT, `/about`, notices, `/debug/read`).
- `server/src/config-save.ts` (patch schema, re-read, merge, temp rename), `config.ts` gains `saved()`, `settings-body.ts`, `notices.ts` (dynamic text import in try/catch, embeds when `THIRD-PARTY-NOTICES.txt` exists at compile), `text.d.ts`.
- `read-loop.ts` gains `rawRead` (uses `exclusive`, `rawBusy` flag). `server.ts` and `main.ts` wired (`config`, `about`, `debug`, `listening`).

**Left, in order:**
1. Tests: route-table test (every `ROUTES` row registered and vice versa; bad Host to every write/debug route gives 403; each rejection path of the guards; `OPTIONS` has no ACAO), `paths` null for LAN peer vs filled for loopback, PUT save tests (unknown keys survive, first save creates file, refused save, bad patch `invalid_setting`, pollHz out of range refused), `/debug/read` errors (`invalid_request`, `not_connected`, `bad_read`, `read_busy`), debug routes absent without the flag, notices 404 when null, error-code enum pin test. Tests go in `server/test/api/` using `app.request(path, init, env)` with `env = { requestIP: () => ({ address: "127.0.0.1" }) }`.
2. `scripts/smoke.ts`: after the viewer check, fetch `/about` and `/about/third-party-notices.txt`; CI compile-smoke must run `bun run notices` before `bun build --compile` (edit `.github/workflows/ci.yml` compile-smoke). Verify locally with `bun run notices` then `bun run build:exe` and `bun scripts/smoke.ts out/pokemon-memory-reader <version>`.
3. Run `bun run lint`, `bun run typecheck`, `bun test`.
4. `council-audit` (Claude seat only, others `n/a`), up to five rounds.
5. Decision report to `.plan/maps/v2-build/assets/075-settings-and-about-routes-report.md`, unslop, timing close, resolution in ticket, push, PR to `wayfinder/v2-build-master`.

**Decisions to put in the report:** PUT refuses out-of-range `pollHz` instead of clamping. Empty patch writes nothing. `/about` also returns `lgpl` and `notices: boolean`. Raw-read timeout maps to `not_connected`. `POST /settings/icon-cache/clear` left out, surfaced as a ticket blocked by 086. Guard and route table built here because 074, 076, 080 and 086 all reuse them.

**Read first:** `server/src/app/app.ts`, `server/src/app/guards.ts`, `server/src/config-save.ts`, `server/src/loop/read-loop.ts` (`rawRead`).
