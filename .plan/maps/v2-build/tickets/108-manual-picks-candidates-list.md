---
type: task
blocked_by: []
---

# `GET /manual-picks` candidates list

## What to build

[Manual ROM picks](./074-manual-picks.md) built the write side of `/manual-picks` and left out the `GET`. Add the read that lists candidate profiles for the unidentified game so the viewer can offer a pick. Each candidate needs a signature read, so check the 074 report and spec §9.6 for how candidates are chosen and what the body holds. Follow [the 021 amendment](../assets/021-viewer-control-routes.md) for the guard and error codes, and add the route to the route-table test.

## Acceptance criteria

- The route lists candidates with their signature result for an unidentified game, and an empty list otherwise.
- It reads through the read loop's slot and never blocks a tick.
- The route-table test covers it, and the viewer's connection screen details ticket can use it.
