---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T13:30:00Z
---

# `GET /manual-picks` candidates list

## What to build

[Manual ROM picks](./074-manual-picks.md) built the write side of `/manual-picks` and left out the `GET`. Add the read that lists candidate profiles for the unidentified game so the viewer can offer a pick. Each candidate needs a signature read, so check the 074 report and spec §9.6 for how candidates are chosen and what the body holds. Follow [the 021 amendment](../assets/021-viewer-control-routes.md) for the guard and error codes, and add the route to the route-table test.

## Acceptance criteria

- The route lists candidates with their signature result for an unidentified game, and an empty list otherwise.
- It reads through the read loop's slot and never blocks a tick.
- The route-table test covers it, and the viewer's connection screen details ticket can use it.

## Resolution

`GET /manual-picks` is an open read that returns `{ romKey, current, candidates }`, with `manualPicksBody` exported from `internal/`. Candidates are every loaded profile of the ROM's platform, header matches first, with a signature result and `baseEligible` from one shared function. The list is filled while the ROM is unidentified or loaded by a manual pick (021 allows changing a pick) and empty otherwise. Signature reads go through the loop's request slot in chunks of at most 64 ranges and 4096 bytes, are cached per session and retried after a failed read. `current` is null for a session-only pick. Not done: `expansion_rom` still waits on the RHHEXP scan. One Claude council seat approved in round 1 of 5 (8). [Decision report](../assets/108-manual-picks-candidates-list-report.md).

Timing: wall 5m, active 5m, user 0s, wait 0s, blocked 0s | implement 3m, audit 1m (1 round) | tools 47 (3 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 145k | cost $1.74 sonnet-5-5 + $0.01 haiku-5-5
