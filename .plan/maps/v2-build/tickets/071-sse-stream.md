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

## Answer

`GET /api/v2/events?topics=...` is built to spec §7.3 and §8.8. The route returns the standard 400 `invalid_topics` body for a list that names no known topic, and ignores unknown names beside known ones. A subscriber counts as demand through the loop's `retain(topics)`, so a cold topic runs the same extra cycle as a cold GET and its first decoded value is the on-connect event. The 5 s warm window starts when the last subscriber of a topic leaves. Each client holds at most one pending event per topic, latest wins, for on-connect values and `status` too. A socket whose `desiredSize` stays at or below 0 for 30 s is closed as a normal end of stream, and a comment heartbeat goes out every 15 s. `status` events now follow adapter state, which ticket 070 left to this one. `boxes` needs no new throttle, because the loop reads boxes at most once per 1000 ms.

The API package gains a `StreamEvent` type, schema, sync pair and `PAIRED` entry, and `subscribe(topics, handlers, options)` in `client.ts` with an injectable `EventSource`, `onConnection`, `onError`, `onUnknown` and `close()`. It imports neither `zod` nor `/schemas`. The packed-tarball steps pass locally (consumer smoke, publint, attw).

Tests: `server/test/api/events.test.ts` (real server: on-connect values, a change, a heartbeat, a 400, and a real paused TCP socket that is detected as unwritable, closed at 30 s and ended on the wire), `stream.test.ts`, `demand.test.ts`, `boxes-rate.test.ts`, `api/src/subscribe.test.ts`. One failure remains, the Lua version check in `core.test.ts` (host has Lua 5.5). Audit: Claude seat approved in round 1 (8). Gemini and GPT seats `n/a` (out of quota). One minor problem fixed, one declined. Report: [071 report](../assets/071-sse-stream-report.md).

Surfaced: the client `validate` option (lazy-load `/schemas`, drop and report an invalid event) is not built, because a test forbids a `/schemas` import in `client.ts`.

Timing: wall 12m, active 11m, user 0s, wait 0s, blocked 0s | implement 8m, audit 2m (1 round) | tools 98 (4 subagent) | limits 0, compactions 0, handoffs 2 | ctx peak 154k | cost $0.02 haiku-5-5 + $3.40 sonnet-5-5
