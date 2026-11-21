---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795285581
claimed_at: 2026-11-21T18:37:00Z
---

# Make the icon cache clear wait for in-flight downloads

## What to build

Surfaced by [Icon cache clear route](./099-icon-cache-clear-route.md). `IconService.clearCache()` doesn't wait for a download already in flight, so that download can write its file back after the clear. Fix it in the `/icons` service from [the icons ticket](./086-icons-route-and-cache.md): clear should settle in-flight downloads first, or drop their writes.

## Acceptance criteria

- A download that finishes after a clear doesn't leave a file in the cache.
- A test starts a download, clears and finishes the download, then checks the cache is empty.
- `POST /settings/icon-cache/clear` behavior is otherwise unchanged.

## Answer

`IconService.clearCache()` now drops the writes of downloads that began before it. Each clear bumps a generation counter, and an older download skips its cache write and its remembered miss. The clear also empties the in-flight map, so a later request fetches fresh, and it waits for cache writes already under way before it deletes. The stale download still answers its own request. The route is unchanged, and backoff is left alone. Audit: Claude seat APPROVE at round 1 (8), Gemini and GPT not run, one minor problem declined. Report: [116 report](../assets/116-icon-cache-clear-waits-for-downloads-report.md).

Timing: wall 2m, active 2m, user 0s, wait 0s, blocked 0s | implement 50s, audit 56s (1 round), gate 45s | tools 22 (4 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 79k | cost $0.59 sonnet-5-5 + $0.01 haiku-5-5
