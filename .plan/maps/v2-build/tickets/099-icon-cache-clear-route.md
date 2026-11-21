---
type: task
blocked_by: [086]
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T14:10:00Z
---

# `POST /settings/icon-cache/clear`

## What to build

The clear route that [`/settings` and `/about` routes](./075-settings-and-about-routes.md) left out because it needs the icon cache. Follow [the 021 amendment](../assets/021-viewer-control-routes.md) for its write guard and error codes, and reuse the shared route table and its test. Ticket 086 builds the `/icons` route and cache, so this clears that cache and nothing else.

## Acceptance criteria

- The route is in the route table, behind the write guard, and the route-table test covers it with its error codes.
- A clear empties the icon cache, and the next `/icons` request fetches again.
- A LAN reader is refused the same way as for `PUT /settings`.

## Resolution

`POST /settings/icon-cache/clear` is a write-guard row in the route table. It calls `IconService.clearCache()` and answers `{}`, so the next `/icons` request fetches again. A LAN peer, bad Host, foreign Origin or non-JSON body gets `403 write_forbidden`, as for `PUT /settings`. An I/O failure answers `save_failed` (500), since the closed error enum gains no code. A download already in flight can still write its file back after a clear, which is a follow-up in the service. [Report](../assets/099-icon-cache-clear-route-report.md)

Timing: wall 2m, active 2m, user 0s, wait 0s, blocked 0s | implement 1m, audit 33s (1 round) | tools 23 (3 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 77k | cost $0.61 sonnet-5-5 + $0.01 haiku-5-5
