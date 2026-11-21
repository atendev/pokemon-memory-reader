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

## Handoff

Branch `t3/box-reads-and-routes`. Code and tests are done and committed as `wip:`. Local: lint, typecheck clean, 796 tests pass, 1 known Lua 5.5 failure in `core.test.ts`.

Done:
- `api/`: `boxes` joined `TOPIC_NAMES`, `ResourceMap`, `resourceSchemas`; `docs/open-enums.md` regenerated.
- `server/src/format/registry.ts`: `BoundBoxes` (with `count`), `declaredRegions` now returns the Emerald box request, gated on `features.boxes`.
- `server/src/loop/read-loop.ts`: box read in the loop (own `PointerCache`, 1000 ms timeout, 1 s interval for ticks and forced GET reads, sha1 hash of raw slices, unreadable boxes on null or failed pointer, 2250 ms GET wait, corruption log wired, SSE slot comment naming ticket 071), `get("boxes")`, `box(n)`.
- `server/src/app/app.ts`: `/boxes` and `/boxes/:n` (404 `not_found`).
- Tests: `server/test/loop/boxes.test.ts` (31), registry box-cap tests, `app.test.ts` stubs.

Audit (Claude seat only; Gemini and GPT skipped, out of quota). Round 1: DISAPPROVE 7. Blocking: forced GET read ignored the 1 s interval after a fast failure. Fixed (`readBoxes` checks `startedAt` for forced reads too) with a test. Minor 2 (fake adapter never enforces the 1000 ms timeout) and minor 3 (GET read uses warm pointer cache; ordering comes from the shared FIFO slot) declined with those reasons.

Left, in order:
1. Round 2 audit (Claude seat, haiku) on the fix hunks in `readBoxes` and the new test. Rounds used: 1.
2. Decision report to `.plan/maps/v2-build/assets/066-box-reads-and-routes-report.md`, run unslop, commit with the work.
3. Timing close (`wf-time.py close --slug v2-build --ticket 066`), record the resolution in this ticket, delete this section, commit, push without force, open a PR against `wayfinder/v2-build-master` and link it.
4. Return DONE with the Decisions line and Surfaced list (none found so far).

Read first: `server/src/loop/read-loop.ts` (`readBoxes`, `freshBoxes`, `box`), `server/test/loop/boxes.test.ts`.
