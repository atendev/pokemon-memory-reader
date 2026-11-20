---
type: task
blocked_by: [073]
---

# `/settings` and `/about` routes

## What to build

Spec §9.5 and [the 021 amendment](../assets/021-viewer-control-routes.md). `GET /settings` shows endpoints, `pollHz` and `updateCheck`, and gains `paths`, which is null for LAN readers. `/about` and `/about/third-party-notices.txt` serve the version, the notices file that `bun run notices` writes (embedded in the executable) and the JavaScriptCore and tinycc copyright lines from [the LGPL ticket](./048-lgpl-notices-about-relinking.md). `--debug` adds `/debug/read` behind a Host check. The shared write guard, the debug Host check and the route-table test come from 021, and internal error codes are a closed enum.

## Acceptance criteria

- Each route is covered by the route-table test, with its guard and error codes.
- `paths` is null for a LAN reader and filled for loopback.
- The compiled executable serves the notices file and the About lines (the compile smoke covers it).
- `--debug` routes are absent without the flag.
