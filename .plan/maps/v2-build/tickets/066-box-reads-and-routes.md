---
type: task
blocked_by: [062, 065]
---

# Box reads in the loop and the `boxes` routes

## What to build

Spec §8.3, §8.4 and §7.9. Boxes are read only when demanded, at most once per 1000 ms (`boxesMinIntervalMs`, internal), in their own request after the main batch in the same cycle, with their own 1000 ms timeout that doesn't count toward `stalled`. The main batch is decoded and emitted before the box request starts, and a game change during the box read waits for it. A GET on a cache older than 1 s triggers one immediate read with the cold-read ordering, waits about 2.25 s at most, and returns the stale cache (not a 503) if that read times out. The program hashes the raw bytes of every region read and caches a new value only when a hash changes.

`GET /api/v2/boxes` returns the whole resource and `GET /api/v2/boxes/:n` one `Box`, with `not_found` for an out-of-range or non-numeric `n`. The box request is no longer empty for Emerald, so [Check batch caps at profile load](./030-batch-caps-at-profile-load.md) now measures a real box request against the 64 KiB bridge cap and must still pass.

## Acceptance criteria

- Both routes work on synthetic Emerald memory through the fake bridge, and the response parses with the real schema.
- Tests cover the 1 s minimum interval, the stale-cache GET with a box timeout, ordering after the main batch, and a pointer change (the pointer-derived region rules).
- The profile load check passes with Emerald's real box request.
- SSE pushes for the `boxes` topic wait for the SSE ticket, and the slot for them is marked.
