---
type: task
blocked_by: [007]
claimed_by: wayfinder-master v2-build-master-1794792924
claimed_at: 2026-11-16T03:41:12Z
---

# Test a bad frame after a good one over TCP

## Question

[Bridge protocol core](./006-bridge-protocol-core.md) tests broken frames at the codec level. Add a TCP-level test where a valid frame is followed by a bad one, and change the test client's `next()` to report `badFrame()` instead of timing out. Do it once the mGBA adapter from [mGBA bridge and adapter](./007-mgba-bridge-and-adapter.md) owns the connection code.

## Acceptance

- The TCP test gets the valid frame, then a `badFrame` result, with no timeout.

## Answer

A raw TCP listener serves a valid frame followed by a bad one, and the test client's `next()` now delivers the valid frame, then throws `BadFrameError` carrying the decoder's reason, with no timeout. `badFrame()` still returns the reason, and `maybeNext()` returns `null` at once on a broken stream. Five tests in `server/test/bridge/tcp-bad-frame.test.ts` cover one write, two writes with `next()` waiting, a bad frame split at its kind byte, a valid frame after the bad one never arriving, and plain silence still timing out. A raw listener serves the bytes because the Lua core never sends a malformed frame. Audit approved on round 2, CI green on c52a19a. [Report](../assets/032-bad-frame-tcp-test-report.md).
