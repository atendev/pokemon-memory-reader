---
type: task
blocked_by: [091]
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T15:30:00Z
---

# Coverage matrix, guard and the `supported` flag

## What to build

Spec §12.7 and §12.8, and the `supported` flag the tracer left out ([009](./009-tracer-api.md), decision 5). Add `supported` to the game binding, build the coverage matrix and the guard that refuses a resource its fixtures don't cover, and report it through `status` and the 503 `unsupported` code from [the 020 amendment](../assets/020-status-and-error-details.md). A data format with no verified fixtures ships with `supported: false`.

## Acceptance criteria

- Tests cover a supported game, an unsupported game and a resource the fixtures don't cover.
- `status.game` and the 503 codes match 020, and the viewer's `unsupported` state works through the connection screen.
- The matrix is generated, not hand-edited, and a CI test fails when it is stale.

## Handoff

Branch `t3/coverage-matrix-support-gate`, SHA aec2570 (the build, all committed). Audit round so far: 0 (none run). Tag `wfm-v2-build-093-1795265782`.

**Done**
- `server/src/format/support.ts`: `SUPPORTED` flags (all false), `isSupported`, `assumeSupported` (`PMR_ASSUME_SUPPORTED` env override, wired in `main.ts` with a warn log).
- `bindGame(profile, support = SUPPORTED)` returns `{ supported: false }` for an unsupported format and sets `BoundGame.supported`. The read loop (`unavailable`) returns 503 `unsupported` when `supported === false`. `ReadLoopDeps.supported` and `ServerOptions.supported` pass the flags through.
- Matrix: `server/test/fixtures/coverage.ts`. Guard, scan and render: `server/test/support/coverage-guard.ts`, `coverage-report.ts`. Script `bun run coverage` (`--check`) writes `docs/coverage.md`.
- Tests: `server/test/fixtures/coverage.test.ts`, `support-flags.test.ts`, and a "support gate" describe in `server/test/loop/read-loop.test.ts`. Existing loop tests now pass `supported: ALL_SUPPORTED` (`server/test/support/supported.ts`). The executable e2e test sets `PMR_ASSUME_SUPPORTED=gen3`.
- Local: lint clean, typecheck clean, `bun test` 1665 pass, 1 fail (Lua 5.5 in `bridge/core.test.ts`, environmental, predates this work).

**Left, in order**
1. Run the council audit (single Claude seat, "Gemini and GPT: not run") on the diff against master `wayfinder/v2-build-master`. Fix problems, up to 5 rounds.
2. Write `.plan/maps/v2-build/assets/093-coverage-matrix-and-support-gate-report.md` (decisions: env override name and why; `bindGame` gating and optional `BoundGame.supported`; doc location `docs/coverage.md`; guard prints via the script, not the test; tier 2 gaps in the doc; smoke slugs `smoke-party`/`smoke-player`; matrix field paths; "full"/"smoke"/"none" checks). Run unslop, commit.
3. Run the timing close (`wf-time.py close --slug v2-build --ticket 093 ...`), add `## Answer`, delete this Handoff section, commit, push without force, open a PR against `wayfinder/v2-build-master` and link it.
4. Surface a ticket: "Capture tier 1 fixtures and lift `supported`" (HITL, needs ROMs and an emulator).

**Open audit problems:** none yet. **Read first:** `server/test/support/coverage-guard.ts`, `server/src/format/registry.ts`, `server/src/format/support.ts`.
