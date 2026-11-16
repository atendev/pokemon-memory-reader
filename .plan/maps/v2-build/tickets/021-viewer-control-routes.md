---
type: grilling
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794807670
claimed_at: 2026-11-16T05:41:45Z
---

# Which routes serve the viewer's controls and info?

## Question

Spec §17 item 9. Decide the routes for the adapter list and switch, candidate profiles and manual picks with their write guards, the update banner, version and third-party notices, the `--debug` raw-read route, and whether Settings shows adapter endpoints, `pollHz` and `updateCheck`.

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

Decided in auto mode. [Amendment 021](../assets/021-viewer-control-routes.md) holds the full answer, and [the decision report](../assets/021-viewer-control-routes-report.md) records each choice.

- The viewer controls are internal root-level routes beside `/settings`, with contracts in `internal/`. They stay out of `/api/v2`, OpenAPI and the API package. The viewer uses hash routes, so no viewer URL collides with a server route.
- `GET /adapters` returns cached probe results and never probes. `POST /adapters/probe` probes now. `POST /adapters/switch` changes the live adapter for this run only: it connects to the new adapter while the old one stays live and never writes config. A pin stays in `PUT /settings`.
- `GET /manual-picks` returns the key, the pick that applied and the candidates for the loaded ROM. `POST /manual-picks { profileId, scope }` makes a pick and `POST /manual-picks/forget {}` forgets one. The server derives the key. Picks are allowed only while the ROM is `unidentified` or loaded by a manual pick, and a pick applies for the session even when it can't be saved.
- `GET /about` returns the version, and `GET /about/third-party-notices.txt` serves the notices file that the release build embeds. `GET /update` returns the cached update-check result. `GET /debug/read?address=&length=` reads in amendment 013 bus notation, up to 4096 bytes.
- One shared write guard covers every write route. Debug routes also check `Host` against the loopback names. A route-table test fails on any route outside `/api/v2` that isn't in the table. Internal errors are `{ error: { code, message } }`, and `code` is a closed enum.
- Settings shows the adapter endpoints, `updateCheck` and `pollHz`. `GET /settings` gains `paths`, which is null for non-loopback peers.
- Excluded: viewer controls in `/api/v2` or an SSE topic, a GET that probes, a switch that writes a pin, picks by key, overriding automatic matches, and managing other ROMs' picks (deferred to v2.x).
