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

## Resolution

`GET /api/v2/status` and `GET /api/v2/party` are served by a Hono app on `127.0.0.1:7425` from live adapter reads. A read loop owns the one request slot, ticks at `pollHz` only while a topic is demanded (5 s), shares one cold read between concurrent GETs, and re-identifies on any game change. Identification is header-only, so `status.game` reports `match: "header"` and `signature: "unchecked"`. A 503 carries `{ error, status }` for `disconnected`, `no_game`, `unidentified`, `unsupported` and `no_data`, and unknown routes and handler failures use the same shape with 404 and 500. An integration test runs the server and the real bridge adapter against the TypeScript fake bridge with synthetic Emerald memory. It gets a 503 before a game loads, then a valid `status` and the expected party. Audit approved in round 2, CI green on 12cda63 (PR 10). The decision report is `../assets/009-tracer-api-report.md`. There is no `supported` flag or coverage guard yet, and `main.ts` belongs to the executable ticket.
