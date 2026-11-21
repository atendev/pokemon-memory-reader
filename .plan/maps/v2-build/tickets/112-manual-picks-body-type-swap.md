---
type: task
blocked_by: [108]
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T14:40:00Z
---

# Swap the local `ManualPicksBody` mirror for the type `internal/` exports

## What to build

Surfaced by [Viewer Settings and About screens](./085-viewer-settings-and-about.md). The Settings pick control reads a local mirror of the manual picks body and falls back on a 404. Once [the candidates list](./108-manual-picks-candidates-list.md) exports its type from `internal/`, import it, delete the mirror and drop the 404 fallback.

## Acceptance criteria

- The viewer imports the body type from `internal/` and has no local copy.
- The pick control lists candidates in the compiled-executable test.
- The 404 fallback and its test are removed.

Timing: wall 1m, active 1m, user 0s, wait 0s, blocked 0s | implement 1m, audit 35s (1 round) | tools 23 (2 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 78k | cost $0.63 sonnet-5-5 + $0.01 haiku-5-5

## Answer

Done. The viewer imports `ManualPicksBody` from `@pokemon-memory-reader/internal/manual-picks-route` in every file and the local mirror is deleted. The 404 branch and its test are removed, and any read failure shows the program's message. The compiled-executable test now runs the executable against an unidentified ROM and checks that `GET /manual-picks` lists the matching profile, and the bundle check rejects the old 404 text. The fixtures' `kind: "vanilla"` was never valid, since the mirror typed `kind` as `string`, so it is now `"official"`. The audit ran on the Claude seat only. [Report](../assets/112-manual-picks-body-type-swap-report.md).
