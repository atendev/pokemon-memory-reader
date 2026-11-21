---
type: task
blocked_by: [079, 073]
claimed_by: wfm-v2-build-master-1795260524
claimed_at: 2026-11-21T12:05:00Z
---

# Adapter selector, discovery and `/adapters`

## What to build

Spec §3.3 and [the 021 amendment](../assets/021-viewer-control-routes.md). The selector fills the slot `read-loop.ts` marks. Discovery probes the available adapters, `/adapters` lists them with probe results, and a switch applies for this run only, behind the shared write guard. A pick is never saved to config, and an adapter that stops responding is shown as a problem in `status.adapter`.

## Acceptance criteria

- Tests cover discovery with only the bridge, only RetroArch, both, and neither.
- A switch changes the live adapter, the old session's resources are dropped, and a restart returns to the configured default.
- The route-table test covers `/adapters`.

## Handoff

Branch `t3/adapter-selector-discovery`, work committed as `wip:` (last code sha bc62c6e). Audit round count so far: 0. No council dispatched yet.

**Done**
- `server/src/adapter/selector.ts`: `createSelector` with a facade `Adapter` for the read loop, `list`, `probeNow`, `switchTo`, `setPin`, `close`. Pin closes the other adapters. A live adapter that disconnects drops and probing resumes. A usable lower-priority adapter is held while a higher one is unsettled (1.5 s).
- `internal/src/adapters-route.ts`: Zod schemas for `/adapters` and the switch body.
- `ManagedAdapter.lastMiss` (optional) added in `adapter/types.ts` and set by the RetroArch adapter, so `refused` and `no_reply` can be told apart.
- `/adapters`, `/adapters/probe`, `/adapters/switch` in `app/app.ts` and `route-table.ts`. `server.ts` takes `selector`. `main.ts` builds mgba and retroarch (bizhawk returns null) and applies a live `adapter` change through `setPin`.
- Tests: `server/test/adapter/selector.test.ts` (10), a `/adapters` route test, and the route-table test now registers the selector. Full `bun test`: 1165 pass, 1 known Lua 5.5 failure. Typecheck and `biome ci` clean.

**Left, in order**
1. Run `council-audit`, Claude seat only, on the diff `git diff wayfinder/v2-build-master...HEAD`. Gemini and GPT are `n/a`. Up to 5 rounds.
2. Write `.plan/maps/v2-build/assets/080-adapter-selector-and-adapters-route-report.md`, run unslop, commit.
3. Run the Timing close (`wf-time.py close --slug v2-build --ticket 080 ...`), add `## Answer` to the ticket, delete this Handoff section, commit, push (no force), open a PR against `wayfinder/v2-build-master` and link it.
4. Return DONE with the Decisions line and Surfaced tickets.

**Likely audit probes**: probe-now uses `hold` to force an immediate connect and waits up to 3 s per bridge and 1 s for RetroArch. A switch passes on `connected` with no problem, since a null game message can't be observed. `status.adapter` while nothing is live follows the first problem adapter (spec §4.7).

**Surface as tickets**: apply live `adapters` endpoint changes (adapters are built once with the startup endpoint); BizHawk adapter wiring into the selector's `create`.

Files to read first: `server/src/adapter/selector.ts`, `server/test/adapter/selector.test.ts`, `server/src/main.ts`.
