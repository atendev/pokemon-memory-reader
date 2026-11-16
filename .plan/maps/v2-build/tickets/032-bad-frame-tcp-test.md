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
