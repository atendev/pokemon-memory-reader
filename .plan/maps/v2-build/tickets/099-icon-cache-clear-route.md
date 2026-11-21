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
