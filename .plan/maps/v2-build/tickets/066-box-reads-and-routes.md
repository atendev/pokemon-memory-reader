---
type: task
blocked_by: [062, 065]
claimed_by: wfm-v2-build-master-1795256075
claimed_at: 2026-11-21T10:45:51Z
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

## Answer

Boxes are read in the loop only when demanded, at most once per 1000 ms, in their own request after the main batch with their own 1000 ms timeout that never counts toward `stalled`. `GET /api/v2/boxes` and `GET /api/v2/boxes/:n` work on synthetic Emerald memory, and `:n` out of range or non-numeric gives 404 `not_found`.

- The format registry binds the box request (`BoundBoxes`, gated on `features.boxes`), and the loop keeps a separate pointer cache for it.
- A stale GET triggers one shared read, waits at most 2250 ms and returns the stale cache. The 1 s interval holds for forced reads too, so a read that failed fast isn't retried by every GET.
- The loop hashes the raw bytes (sha1) and replaces the cache only when the hash changes. A moved or unread pointer drops the read. An unreadable storage block makes every box unreadable.
- Emerald's real box request passes the 64 KiB profile load check.
- The SSE push for `boxes` is a marked slot in `keepBoxes` that names the SSE ticket (071).

Excluded: a test of a hung box read, because the fake adapter doesn't enforce the 1000 ms timeout and the bridge owns it. Audit: Claude seat approved in round 2 (8). Gemini and GPT seats skipped (out of quota). Report: [066 report](../assets/066-box-reads-and-routes-report.md).

Timing: wall 10m, active 10m, user 0s, wait 0s, blocked 0s | implement 5m, audit 2m (2 rounds), fix 55s, gate 52s | tools 64 (5 subagent) | limits 0, compactions 0, handoffs 1 | ctx peak 155k | cost $2.41 sonnet-5-5 + $0.02 haiku-5-5
