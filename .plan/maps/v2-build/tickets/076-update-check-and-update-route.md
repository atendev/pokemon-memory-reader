---
type: task
blocked_by: [073]
claimed_by: wfm-v2-build-master-1795260524
claimed_at: 2026-11-21T12:31:46Z
---

# Update check and the `/update` route

## What to build

Spec §9.8 and [the 021 amendment](../assets/021-viewer-control-routes.md). The `updateCheck` setting, the check against the release feed, and the internal `/update` route the viewer banner reads. The check never runs with `updateCheck` off, never blocks startup, and never fails the server on a network error. It is tested against a fake feed, with no real network in CI.

## Acceptance criteria

- Tests cover the setting off, an up-to-date build, a newer release, a prerelease channel per [the prerelease amendment](../assets/024-prereleases-without-main.md), a network error and a malformed feed.
- `/update` follows the route-table test and write guard rules where it writes.
- No request leaves the process in the default test suite.

## Resolution

`GET /update` is an open read that returns `{ enabled, current, latest, checkedAt }` from the last check and never calls GitHub. The checker in `server/src/update/` lists the releases at startup and every 24 hours, after the server is listening. It keeps only `v` plus semver tags, skips drafts, and orders versions by semver. A stable build compares against non-prerelease releases only, and a prerelease build against all of them. A failed or malformed check changes nothing and logs only under `--debug`. A live `updateCheck` change cancels the next check or schedules one 5 seconds later. A `bun test` preload rejects remote `fetch` and sets `PMR_UPDATE_CHECK=off` for spawned programs, so no request leaves the process in the suite. The council's Claude seat approved in round 1 with 8. The other two seats were out of quota. [Decision report](../assets/076-update-check-and-update-route-report.md).

Timing: wall 4m, active 4m, user 0s, wait 0s, blocked 0s | implement 2m, audit 1m (1 round) | tools 36 (2 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 119k | cost $1.28 sonnet-5-5 + $0.01 haiku-5-5
