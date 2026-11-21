---
type: task
blocked_by: [070]
claimed_by: wfm-v2-build-master-1795260524
claimed_at: 2026-11-21T11:50:18Z
---

# SSE stream, topics and slow clients

## What to build

Spec §7.3, §8.2 and §8.8, with the 400 `invalid_topics` and error shape from [the 020 amendment](../assets/020-status-and-error-details.md). An SSE subscriber counts as demand for its topics. A subscriber to a cold topic triggers the same extra cycle as a cold GET and receives the first decoded value as its on-connect event. Each client holds at most one pending event per topic, and latest wins: a newer event replaces the queued one and goes to the tail, for on-connect values and `status` too, with no cross-topic ordering promise. A client whose socket stays unwritable for 30 s is closed as a normal end of stream. A comment heartbeat goes out every 15 s.

Subscribers receive change events from the change-detection ticket. The `boxes` topic is pushed at 1 Hz at most. The API client's SSE types follow the sync rules (a type, a sync pair and a `PAIRED` entry for each event).

## Acceptance criteria

- A real-server test subscribes to several topics and gets on-connect values, then change events, then a heartbeat.
- Tests cover latest-wins replacement, the 30 s close with a fake clock, an invalid topic's 400, and a cold-topic subscribe.
- Demand lapses when the last subscriber leaves and the 5 s warm window applies.
- The `/client` SSE helper is typed without `zod`, and the packed-tarball CI check still passes.

## Handoff

Branch `t3/60ced9c7`. Audit rounds used: 0 (no council yet). Tag `wfm-v2-build-071-1795260524`.

**Done (committed as `wip:`)**
- `server/src/loop/read-loop.ts`: `StreamSource` interface, loop-level `retain(topics)` demand count (survives sessions, window starts when the last subscriber leaves, a lapsed topic's cached value is dropped so the subscriber's `get` runs cold), and `announceStatus()` which emits a `status` event whenever `status()` deep-differs (adapter state change, identification done, stall flip).
- `server/src/app/stream.ts`: `parseTopics`, `createStreamHub` (latest-wins queue per client, 15 s heartbeat, 30 s unwritable close, on-connect via `get`), `Sink`.
- `server/src/app/app.ts`: `GET /api/v2/events` (400 `invalid_topics` with status, `server.timeout(req, 0)`, ReadableStream with highWaterMark 1, `pull` as drain). `server.ts` builds the hub and closes it in `stop()`.
- Tests: `test/loop/demand.test.ts`, `test/api/stream.test.ts` (21 pass), shared `test/support/scripted-adapter.ts`, `change-detection.test.ts` updated for status events. Server typecheck clean.

**Left, in order**
1. Real-server test (`server/test/api/events.test.ts`): `Bun.serve` + `createReadLoop` (ManualClock, ScriptedAdapter) + hub + `createApp`; read the stream with `fetch`; check on-connect values, a change event, then a heartbeat (`clock.advance(15000)`). Also confirm with a real paused TCP socket that `controller.desiredSize <= 0` detects an unwritable socket in Bun, then advance 30 s and see the stream end. If detection fails, rework the sink.
2. Boxes at 1 Hz: add a test (loop already reads at most once per 1000 ms; check across a game change).
3. API package: SSE event type in `api/src/types.ts`, Zod schema in `schemas.ts`, sync pair in `sync.test.ts` plus `PAIRED` entry, and `subscribe(topics, handlers, options)` in `client.ts` (injectable `EventSource`, `baseUrl`, `onConnection`, `onError`, `onUnknown`, `close()`, `connection`; no zod import, not even dynamic: a test forbids it). A CLOSED error on connect reports `PmrApiError` kind `http`. Skip `validate`; surface a ticket for it. Add client tests with a fake `EventSource`.
4. Run the packed-tarball check (`api-package` CI steps locally if possible), `bun run lint`, `bun run typecheck`, whole `bun test` (known failure: Lua version in `server/test/bridge/core.test.ts`).
5. Council audit (Claude seat only), decision report to `.plan/maps/v2-build/assets/071-sse-stream-report.md` (unslop), Timing close, delete this section, commit, push, DONE.

**Read first:** `server/src/app/stream.ts`, the `retain`/`announceStatus` parts of `read-loop.ts`, `app.ts` events route, `api/src/client.ts`, `api/src/sync.test.ts`.

**Decisions so far:** status events now follow adapter state (070 left that to this ticket); `Resources` is unchanged, the stream reads `StreamSource`; `/events` registers only when a `stream` hub is given.
