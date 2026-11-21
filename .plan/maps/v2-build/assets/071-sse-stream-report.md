# Decision report: SSE stream, topics and slow clients

Branch `t3/sse-stream-topics-slow-clients-2`, cut from `452a02f` (the handoff). Audit: one council round, Claude seat only (the Gemini and GPT seats are out of quota, so they count as `n/a`). Verdict APPROVE, score 8, two minor problems. The repo has no `workflow.md` or `AGENTS.md` ticket loop, so the runner's own gates applied.

## Decisions

| # | Question | Options | Choice | Who |
|---|---|---|---|---|
| 1 | Where does the stream get its data? | Widen `Resources`, or add a narrower `StreamSource` (`status`, `get`, `onChange`, `retain`) | `StreamSource`. `Resources` is unchanged. | Implementer (first thread) |
| 2 | Who counts demand for a topic? | Per session, or in the loop | The loop. `retain(topics)` survives sessions, and the 5 s warm window starts when the last subscriber of a topic leaves. A lapsed topic's cached value is dropped, so the subscriber's `get` runs cold. | Implementer |
| 3 | When does a `status` event go out? | Only on stall changes, or on any change of `status()` | Whenever `status()` deep-differs: adapter state change, identification done, stall flip. Ticket 070 left this open. | Implementer |
| 4 | How is a slow client detected? | Byte counters, or `controller.desiredSize` of a `highWaterMark: 1` stream | `desiredSize <= 0`. A real paused TCP socket in `server/test/api/events.test.ts` confirms Bun reports it, the 30 s timer closes the client, and the response ends with the chunked terminator once the client reads again. | Implementer |
| 5 | Does `/events` always exist? | Always registered, or only with a hub | Only when `createApp` gets a `stream` hub. Without one it is a 404. | Implementer |
| 6 | Does the 1 Hz cap on `boxes` need new code? | New throttle, or rely on the loop's 1000 ms minimum between box reads | No new code. `server/test/loop/boxes-rate.test.ts` changes the box every 200 ms for 10 s and sees at most 10 pushes. A game change reads boxes at once. | Implementer |
| 7 | What is the SSE event type in the API package? | One type per topic, or one union | One `StreamEvent` union, `{ topic, data }` per topic, with a Zod `discriminatedUnion`, a sync pair and a `PAIRED` entry. The sync test fails if a topic is added to `ResourceMap` without a matching event. | Implementer |
| 8 | Which `subscribe` options does this ticket build? | All of spec 015 including `validate`, or all but `validate` | All but `validate`. A test forbids any `zod` or `/schemas` import in `client.ts`, even a dynamic one. Surfaced as a ticket. | Master's brief |
| 9 | How does `subscribe` know a topic is known? | Import the schemas, or read `TOPIC_NAMES` from `meanings.ts` | `TOPIC_NAMES`, which has no Zod dependency. Unknown requested topics go to `onUnknown(topic, data)` unvalidated. | Implementer |
| 10 | How does `subscribe` read a refused connection? | Parse the status, or use `readyState` | `EventSource` hides the status. A `CLOSED` state on error closes the subscription with no retry and reports `PmrApiError` kind `http`. A `CONNECTING` state on error is `reconnecting`. | Implementer |
| 11 | Can the tests prove the packed tarball still works? | Skip, or run the `api-package` job steps locally | Run them: build, `bun pm pack`, `api-consumer-smoke.ts` (both module modes ok), `publint` (all good), `attw --profile esm-only` (ESM and bundler green). | Implementer |

## Verification

- Whole `bun test`: 1100 pass, 5 skip, 1 fail. The failure is the known Lua version check in `server/test/bridge/core.test.ts`, which sees Lua 5.5 on this host.
- `bun run lint` and `bun run typecheck` are clean.
- Real-server test: on-connect values, a change event, then a heartbeat after `clock.advance(15000)`. Also a 400 over the wire and the paused-socket close.

## Audit

Round 1, Claude seat (haiku): APPROVE, 8. Gemini seat `n/a`, GPT seat `n/a`. One Claude APPROVE passes the gate, per the master's brief.

| Problem | Verdict | Handling |
|---|---|---|
| The slow-socket test only checked that demand was released, not that the response ended. | Minor | Fixed. The test now resumes the socket and waits for the chunked terminator. It passes, and the product code did not change. |
| `sink.write` is not wrapped in `try/catch` the way `sink.close` is, so a throwing `enqueue` could skip later clients in the hub's change listener. | Minor, declined | The route cancels the stream into `client.close()`, which sets `closed` and removes the client before any later write. Our own `close()` also sets `closed` first. The hub never writes to a controller the runtime closed. The seat marked it unverified. If a field report shows otherwise, the fix is one `try/catch` in `flush`. |

Minor problems declined: 1.

## Surfaced

- Client `validate` option: lazy-load `/schemas` in `subscribe` and `get`, drop an event that fails and report `PmrApiError` kind `invalid`. Blocked on the test that forbids a `/schemas` import in `client.ts`, so that test needs a rule that allows a dynamic import behind the option.
