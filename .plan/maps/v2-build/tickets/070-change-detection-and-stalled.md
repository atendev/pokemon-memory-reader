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
