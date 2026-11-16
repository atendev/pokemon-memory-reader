---
type: task
blocked_by: [007, 008, 014, 016, 020, 025]
claimed_by: wayfinder-master v2-build-master-1794792924
claimed_at: 2026-11-16T03:04:46Z
---

# Tracer API: status and party

## Question

Serve `GET /api/v2/status` and `GET /api/v2/party` from live adapter reads, end to end. Follow the API contract, identification and read loop sections of the spec.

- The Hono app runs on `127.0.0.1:7425`.
- Identification is header-only for now (the full order comes later).
- A minimal tick loop reads the party at `pollHz` only while it's demanded.
- `503` with a status-carrying error when no game is loaded.
- Responses validate against the API package's schemas.

SSE, change detection, `stalled`, config and the other resources are out of this ticket. Note in the code where they slot in, matching Core module interfaces.

## Acceptance

- An integration test runs the server against the TypeScript fake bridge serving synthetic Emerald memory, and gets a valid `status` and the expected `party`.
- It also gets a `503` before a game is loaded.

## Handoff

Branch `t3/tracer-api-status-party`, WIP commit on top of 62c5305. Audit round so far: 0 (no auditor started). Tag `wfm-v2-build-009-1794792924`.

**Done (typecheck passes, lint only has warnings):**
- `hono@4.13.13` added to `server/`. `api/src/schemas.ts` gained `StatusResource`, `Rom`, `Game`, `AdapterInfo`, `ErrorBody`, `TOPICS` (`status`, `party` only), `resourceSchemas`, `ResourceMap`. `api/src/client.ts` gained `DEFAULT_PORT`, `DEFAULT_HOST`, `DEFAULT_BASE_URL`.
- `server/src/`: `loop/job.ts`, `loop/plan.ts` (merged batch), `loop/read-loop.ts` (one request slot, tick at `pollHz`, 5 s demand, shared cold GET, session reset on epoch change), `identify/header.ts` and `identify/identify.ts` (header-only), `format/registry.ts` (`bindGame`), `resource/status.ts`, `app/app.ts` (status, party, CORS and PNA), `server.ts` (`startServer`). No `main.ts`: ticket 010 owns the entry point.

**Left, in order:**
1. Finish `server/test/api/tracer.test.ts` (TODO inside): `bridge.start(bridgePort)` with `game = null`, expect 503 `no_game`, then `bridge.sendGame(GBA_GAME)`, wait for `state: "game"`, validate status with `StatusResource`, party with `Party`, and compare with `gen3Party.decode` on the same bytes. Remove the unused imports biome warns about.
2. Unit tests: `identify` (GBA and GB header parse, `identifyByHeader`), `plan.ts` merging, `buildStatus` states, and a loop test with a fake in-memory adapter and `ManualClock` (no reads without demand, one shared cold read, warm GET no read, demand lapses after 5 s, no overlapping reads, game change resets values).
3. `bun test`, `bun run lint`, `bun run typecheck`.
4. Audit (haiku, up to five rounds), decision report to `.plan/maps/v2-build/assets/009-tracer-api-report.md` with unslop, commit, push, return PUSHED.

**Decisions to report:** header-only identification gives `match: "header"` and `signature: "unchecked"`; `status.adapter` is null unless usable or a problem exists; no `supported` flag yet (surface a ticket: support flag and coverage guard); decode failure keeps the last good value; cold GET deletes any stale value first; `no_game` while identification is pending.

**Read first:** `server/src/loop/read-loop.ts`, `server/src/resource/status.ts`, `server/test/api/tracer.test.ts`, `server/test/support/emerald-memory.ts`.
