---
type: task
blocked_by: [007, 008, 014, 016, 020, 025]
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
