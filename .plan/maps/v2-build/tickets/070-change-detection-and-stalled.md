---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795260524
claimed_at: 2026-11-21T11:40:00Z
---

# Change detection and the `stalled` flag

## What to build

Spec §8.6, in the slot `read-loop.ts` marks for it. Two stages: compare each resource's raw slice bytes to the last tick's and skip decoding when equal, otherwise decode, deep-compare to the last emitted value and emit only on a difference. The in-battle flag is part of the `battle` raw key. The first successful decode always emits and doubles as the on-connect value. A decode or validation failure emits nothing and leaves state unchanged.

Each batch has the 250 ms timeout. After 1 s of consecutive timeouts, `status.adapter.stalled` becomes true, and the next good read clears it. Cold-read timeouts count. Box timeouts and bridge errors don't. [The tracer](./009-tracer-api.md) kept `stalled` false (its decision 9), and this ticket replaces that. The change events go to an internal subscriber list that the SSE ticket reads.

## Acceptance criteria

- Tests with `ManualClock` cover raw-byte skips, deep-compare skips, first-decode emit, and a failed decode that emits nothing.
- Tests cover `stalled` turning true after 1 s of timeouts, clearing on a good read, cold-read timeouts counting, and box timeouts and bridge errors not counting.
- `status.adapter.stalled` reflects it through the real server and fake bridge.

## Answer

The read loop implements spec §8.6. Each resource skips its decode when its raw bytes match the last tick's, and otherwise decodes, deep-compares to the last emitted value and emits only on a difference. The first successful decode emits, and a failed decode emits nothing and leaves state unchanged. Changes go to an internal subscriber list (`onChange`) for the SSE ticket. `status.adapter.stalled` turns true after 1 s of consecutive main-batch timeouts and clears on the next good read, through the real server and the fake bridge.

- The in-battle flag is part of the `battle` raw key. Battle skips only while the tracker isn't failing validation, and the hash is kept only after a clean decode.
- Cold-read and identification timeouts count. Box timeouts never report. A bridge error neither counts nor ends a run.
- A pause of over 1 s with no batch breaks the run, so one timeout after a quiet period doesn't set `stalled`.
- A `status` change event goes out only when `stalled` flips. `stalled` lives on the session, so a new game starts clear.

Tests: `change-detection.test.ts` (new), `status.test.ts` and a real-server `stalled` test in `tracer.test.ts`. One failure remains, the Lua version check in `core.test.ts`, which fails the same way on the master branch because this host runs Lua 5.5. Audit: Claude seat approved in round 3 (8). Gemini and GPT seats `n/a` (out of quota). Report: [070 report](../assets/070-change-detection-and-stalled-report.md).

Timing: wall 14m, active 13m, user 0s, wait 0s, blocked 0s | implement 7m, audit 5m (3 rounds), gate 40s | tools 75 (8 subagent) | limits 0, compactions 0, handoffs 1 | ctx peak 156k | cost $2.73 sonnet-5-5 + $0.03 haiku-5-5
