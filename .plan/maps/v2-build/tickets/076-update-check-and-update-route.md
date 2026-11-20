---
type: task
blocked_by: [073]
---

# Update check and the `/update` route

## What to build

Spec §9.8 and [the 021 amendment](../assets/021-viewer-control-routes.md). The `updateCheck` setting, the check against the release feed, and the internal `/update` route the viewer banner reads. The check never runs with `updateCheck` off, never blocks startup, and never fails the server on a network error. It is tested against a fake feed, with no real network in CI.

## Acceptance criteria

- Tests cover the setting off, an up-to-date build, a newer release, a prerelease channel per [the prerelease amendment](../assets/024-prereleases-without-main.md), a network error and a malformed feed.
- `/update` follows the route-table test and write guard rules where it writes.
- No request leaves the process in the default test suite.
