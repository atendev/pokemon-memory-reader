---
type: task
blocked_by: [070]
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
