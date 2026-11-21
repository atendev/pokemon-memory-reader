---
type: task
blocked_by: [073]
claimed_by: wfm-v2-build-master-1795260524
claimed_at: 2026-11-21T11:40:00Z
---

# `/settings` and `/about` routes

## What to build

Spec §9.5 and [the 021 amendment](../assets/021-viewer-control-routes.md). `GET /settings` shows endpoints, `pollHz` and `updateCheck`, and gains `paths`, which is null for LAN readers. `/about` and `/about/third-party-notices.txt` serve the version, the notices file that `bun run notices` writes (embedded in the executable) and the JavaScriptCore and tinycc copyright lines from [the LGPL ticket](./048-lgpl-notices-about-relinking.md). `--debug` adds `/debug/read` behind a Host check. The shared write guard, the debug Host check and the route-table test come from 021, and internal error codes are a closed enum.

## Acceptance criteria

- Each route is covered by the route-table test, with its guard and error codes.
- `paths` is null for a LAN reader and filled for loopback.
- The compiled executable serves the notices file and the About lines (the compile smoke covers it).
- `--debug` routes are absent without the flag.

## Resolution

`GET` and `PUT /settings`, `GET /about`, `GET /about/third-party-notices.txt` and `--debug`'s `GET /debug/read` are built on the shared guards and route table from amendment 021. `internalRoute` takes each route's guard class from `ROUTES` and throws for a route not listed, and a route-table test checks every row is registered and every guarded route refuses a bad Host. `paths` is null for a LAN reader and filled for loopback. `PUT` refuses an out-of-range `pollHz` instead of clamping, writes nothing for an empty patch, and saves through a re-read, deep merge and temp-file rename. The notices file is a dynamic text import, so a release build embeds it and a dev build answers 404. The compile and rehost smoke jobs now run `bun run notices` first, and the smoke checks `/about` for the JavaScriptCore and tinycc lines and the notices text. `POST /settings/icon-cache/clear` is left to a ticket blocked by the icons route ticket. Report: [075 report](../assets/075-settings-and-about-routes-report.md). Audit: Claude seat only, approved in round 2 (8).

Timing: wall 14m, active 10m, user 0s, wait 3m, blocked 0s | setup 8m, audit 1m (1 round), fix 48s, handoff 3m | tools 79 (5 subagent) | limits 0, compactions 0, handoffs 1 | ctx peak 158k | cost $3.11 sonnet-5-5 + $0.02 haiku-5-5
