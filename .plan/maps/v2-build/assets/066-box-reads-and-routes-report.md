# Box reads in the loop and the `boxes` routes: decision report

## Result

Boxes are read in the loop only when demanded. `GET /api/v2/boxes` returns the whole resource and `GET /api/v2/boxes/:n` one `Box`. Both work on synthetic Emerald memory through the fake bridge. Local checks: lint and typecheck clean, 796 tests pass, 1 fails (`server/test/bridge/core.test.ts`, the Lua version check, because this host's default `lua` is 5.5 and CI uses 5.4).

## Decisions

1. **Where the box request is declared.**
   - Question: how does the loop learn Emerald's box regions?
   - Options: hard-code them in the loop, or have the format registry bind them.
   - Choice: the registry. `BoundBoxes` carries the regions, a decoder and the box count, and `declaredRegions` returns the Emerald box request when `features.boxes` is set.
   - Made by: implementer. Audit: approved.
2. **Own pointer cache and own timeout.**
   - Question: should box reads share the main batch's pointer cache and timeout?
   - Choice: no. Boxes get their own `PointerCache` and a 1000 ms timeout (`BOX_TIMEOUT_MS`), and a box timeout or failed read never counts toward `stalled`. Spec §8.3.
   - Made by: implementer. Audit: approved.
3. **Ordering.** A tick runs the main batch first and decodes and emits it, then reads boxes in a separate request in the same cycle (`work`). A game change during the box read waits for it through the shared `exclusive` slot.
   - Made by: implementer. Audit: approved.
4. **1 s minimum interval.**
   - Question: does a stale-cache GET bypass the interval?
   - Options: forced reads skip the interval, or they obey it.
   - Choice: they obey it. A forced read is skipped when the last read started under a second ago, or when the cache became fresh while the read waited for the slot.
   - Why: the audit's round 1 blocking problem. A read that failed fast (a moved pointer) left the cache stale, so every GET inside the second re-sent a box request.
   - Made by: council seat found it, implementer fixed it (`readBoxes` checks `startedAt` for forced reads, with a test). Audit: round 2 approved.
5. **Hashing.** The program hashes (sha1) the raw bytes of every region read, and replaces the cached value only when the hash changes. An unchanged hash only refreshes `readAt`.
   - Made by: implementer. Audit: approved.
6. **Pointer change.** A read whose pointer moved or never read is dropped and leaves the cache as it was, and the next read addresses the new target. A storage block that can't be read makes every box unreadable (spec §7.9).
   - Made by: implementer. Audit: approved.
7. **Stale GET.** A GET on a cache older than 1 s triggers one shared read (`state.triggered`), waits at most 2250 ms, and returns the stale cache if the read doesn't finish. It never returns a 503 when a cache exists.
   - Made by: implementer. Audit: approved.
8. **Routes.** `/boxes` and `/boxes/:n` live in `server/src/app/app.ts`. A non-numeric or out-of-range `n` returns 404 `not_found`. `boxes` joined `TOPIC_NAMES`, `ResourceMap` and `resourceSchemas` in `api/`, and `docs/open-enums.md` was regenerated.
   - Made by: implementer. Audit: approved.
9. **SSE.** The `boxes` push is a marked slot in `keepBoxes` that names the SSE ticket (071). It is not built here, as the ticket says.
   - Made by: implementer. Audit: approved.
10. **Batch cap check.** Emerald's real box request is now measured against the 64 KiB bridge cap by registry tests, and it passes.
    - Made by: implementer. Audit: approved.

## Audit

Claude seat only. The Gemini and GPT seats were skipped (out of quota).

- Round 1: DISAPPROVE, 7. One blocking problem (decision 4), fixed.
- Round 2: APPROVE, 8. No blocking problems.
- Gemini and GPT seats skipped (out of quota). Approval rests on the Claude seat.

## Minor problems declined

- The fake adapter never enforces the 1000 ms timeout, so no test covers a hung box read. Raised in rounds 1 and 2. Declined: the timeout is passed to `adapter.read` exactly as the main batch does, and the bridge owns enforcing it. Timeout handling there has its own tests.
- A hung box read holds the shared `exclusive` slot until the adapter's timeout fires. Declined: this is the same behaviour as the main batch, and the wait in `freshBoxes` is bounded at 2250 ms regardless.
- The forced GET read uses the warm pointer cache, so ordering comes from the shared FIFO slot and not from a fresh pointer read. Declined: the pointer-moved path drops stale bytes, so this is safe.

## Surfaced tickets

None.
