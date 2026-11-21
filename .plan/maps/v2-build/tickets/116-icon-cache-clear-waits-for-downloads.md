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
