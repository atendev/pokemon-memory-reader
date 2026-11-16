# Tracer API, status and party: decision report

Ticket: [Tracer API: status and party](../tickets/009-tracer-api.md). Two implementer threads built this, and the second picked up a handoff. The implementer made every decision below unless noted.

## What was built

- `server/src/loop/read-loop.ts` is the read loop. It owns the one request slot and ticks at `pollHz`. It reads a topic only while that topic had a GET in the last 5 s, and it shares one cold read between GETs that arrive together. A game or connection change replaces the whole session.
- `server/src/loop/{job,plan}.ts` hold a stepwise read job and a planner. The planner merges regions in one domain that sit closer than `mergeGap` into one range.
- `server/src/identify/{header,identify}.ts` do header-only identification for GBA and GB.
- `server/src/format/registry.ts` has `bindGame`, which ties a profile's data format to its decoder and reference data.
- `server/src/resource/status.ts` builds the `status` resource.
- `server/src/app/app.ts` and `server/src/server.ts` are the Hono app and `startServer`. The app serves `GET /api/v2/status` and `GET /api/v2/party`, CORS and Private Network Access. There is no `main.ts`, because the executable ticket owns the entry point.
- `api/src/schemas.ts` gained `StatusResource`, `ErrorBody`, `TOPICS` and `ResourceMap`. `api/src/client.ts` gained the default host, port and base URL.
- `hono@4.13.13` is a new dependency of `server/`.

No ROM bytes are committed. The tests use synthetic Emerald memory.

## Decisions

1. **Header-only identification reports `match: "header"` and `signature: "unchecked"`.** The options were `null` or a new value. The four-value set from amendment 025 already has `unchecked`, so a profile that declares signature words gets it and a profile with none gets `null`. Hash matching and the signature check slot in ahead of the header match.
2. **`status.adapter` is null unless the adapter is usable or reports a problem.** A disconnected adapter with no problem has nothing to describe. A problem keeps `{ id, stalled, bridge, problem }` and `state` reads `disconnected`.
3. **`no_game` while identification is pending.** A usable adapter with a game but no identification yet reports `no_game`, so a client never sees a game before its profile is known. `rom` already carries the hashes in that window.
4. **A decode failure keeps the last good value, and a cold GET deletes it first.** A warm GET during a bad frame returns the previous party. After demand lapses, the next GET deletes the stale value, runs one cycle and returns `503 no_data` if that cycle also fails. A stale party is never served as fresh.
5. **No `supported` flag yet.** `bindGame` binds a decoder whenever the format and reference data exist. The flag and its coverage guard need fixtures (spec §6.1, §12.8). Surfaced as a ticket.
6. **One request slot through a promise chain.** Identification, the tick cycle and cold reads each run through `exclusive`, so reads never overlap. A failed task does not block the next.
7. **A cycle that overruns skips the missed ticks.** The next tick waits `max(0, interval - elapsed)`, so ticks never queue (spec §8.1). A rejected tick is logged and the loop keeps running (audit round 1).
8. **`pollHz` normalises in the loop.** An integer clamps to 5-60 and anything else falls back to 20, each with a warning. The config ticket will pass the configured value in.
9. **A timeout or failed read keeps the last value and does not count.** `stalled` stays false. Counting timeouts belongs to the stall check (spec §8.6).
10. **Error bodies are `{ error: { code, message }, status }` with fixed English text.** The 503 checks run in amendment 020's order: `disconnected`, `no_game`, `unidentified`, `unsupported`, `no_data`.
11. **Unknown routes and handler failures use the same error shape.** The auditor noted that Hono's default text body breaks amendment 020's rule that every error body carries `status`. The app now answers a 404 with `not_found` and a 500 with `internal`, both with the status attached, and logs the failure through the injected `Log`.
12. **The handlers do no runtime schema parse.** The auditor raised this. Responses are typed against `ResourceMap` and `ErrorBody` at compile time and every test response is parsed with the real schemas. Parsing each response at up to 60 Hz of demand adds cost to a local read-only server and catches only a decoder bug the tests already cover. The implementer decided this and the auditor accepted it.
13. **Later work has marked slots.** SSE demand, change detection, `stalled`, the adapter selector and box reads each have a comment at the place they join, matching interfaces 004.

## Verification

- `server/test/api/tracer.test.ts` runs the real server and the real bridge adapter against the TypeScript fake bridge serving synthetic Emerald memory. It checks a `503 disconnected` with no bridge, a `503 no_game` once the bridge connects with no ROM, then a valid `StatusResource` and a `Party` that matches the Treecko spec field by field (species, nickname, level, HP, trainer, moves). It also checks the CORS header and the 404 body, and compares the party with `gen3Party.decode` on the same bytes.
- Unit tests cover header parsing and identification, batch planning, `buildStatus` for every state, the 500 body, and the loop with an in-memory adapter and `ManualClock`. The loop tests cover no reads without demand, one shared cold read, a warm GET with no read, demand lapsing after 5 s, no overlapping reads, a game change resetting values, a disconnect, a decode failure, and `pollHz` clamping.
- `bun run lint` and `bun run typecheck` pass. `bun test` passes except the existing Lua version test, which fails on this machine because it has Lua 5.5 (CI pins 5.3 and 5.4).

## Audit

One haiku auditor ran both rounds. Round 1 blocked on two test gaps (the party content was not asserted against the known input, and the warm decode-failure test did not prove the loop re-read the bad bytes) and raised the 404/500 body, the missing handler parse, the `as never` casts and the unguarded tick rejection. The implementer fixed the first two, added the error bodies and the catch, and declined the parse and the casts. Round 2 verdict: APPROVE. After approval the implementer added a 500 test and moved the app's failure log to the injected `Log`, both from the auditor's non-blocking notes.

## Surfaced

- Support flag and coverage guard. Add `supported` to the game binding and refuse a resource when fixtures don't cover it. Blocked by the tickets that capture fixtures.
