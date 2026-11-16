# Ticket 032 decision report: bad frame after a good one over TCP

Branch `t3/tcp-bad-frame-after-good`. Audit: APPROVE on round 2 of 5. No grilling. Decided in the main thread, audited by one haiku subagent.

## What changed

- `server/test/bridge/lua-bridge.ts`: the TCP test client moved out of `LuaBridge.connect()` into an exported `connectTestClient(port)`. `LuaBridge.connect()` calls it, so existing tests behave as before.
- `next()` now throws `BadFrameError` (with the decoder's `reason`) once the stream broke and no valid frame is left. Before, it waited out its timeout. `badFrame()` still returns the reason. `maybeNext()` returns `null` at once on a broken stream.
- `server/test/bridge/tcp-bad-frame.test.ts` is new. It serves bytes from a raw Bun TCP listener, because the Lua core never sends a malformed frame.

## Decisions

1. **Where does a bad frame come from?**
   - Options: make the Lua harness send one, or serve raw bytes from a plain listener.
   - Choice: a plain listener. The Lua core only sends valid frames, so a harness hook would test a path the bridge never takes. Made by the main thread. Audit: approved.

2. **What does "report `badFrame()`" mean for `next()`?**
   - Options: return a result object, return `null`, or throw.
   - Choice: throw `BadFrameError` carrying the reason. Every existing caller already expects `next()` to return a frame or throw, and a thrown error cannot be mistaken for a frame. `badFrame()` stays for callers that poll. Made by the main thread. Audit: approved.

3. **What happens to valid frames before the break?**
   - Choice: `next()` delivers them first, then throws. This matches `FrameDecoder.push`, which returns the frames parsed before the break. Made by the main thread. Audit: approved.

4. **`maybeNext()` on a broken stream.**
   - Choice: return `null` at once instead of waiting the full timeout. It does not throw, so the existing `maybeNext(20)` checks after a bridge-sent `bad_frame` keep working. Made by the main thread. Audit: approved.

5. **Which cases to test.** Five tests: good and bad in one write, in two writes with `next()` already waiting, a bad frame split so the 4-byte length arrives before the kind byte, a valid frame after the bad one is never delivered, and plain silence still times out with the old error. Made by the main thread, tightened by the auditor in round 1.

## Audit

- Round 1: two problems. The silence test would pass even if `next()` resolved, and the split test cut inside the length, so it did not prove the kind-byte claim. Both fixed by the main thread.
- Round 2: the silence test now asserts `rejects.toThrow("no frame arrived in time")`. The split test sends the whole length with the good frame and then only the kind byte, so a decoder that waited for the whole frame would time out and fail. APPROVE.

## Checks

`bun test` passes 237 tests under Lua 5.4 (`LUA_BIN=lua5.4`). The default `lua` on this machine is 5.5, so one existing test, "the Lua core runs under Lua 5.3 or 5.4", fails there. That failure predates this change and CI uses 5.4. `bun run typecheck` and `bun run lint` pass.

## Left for the master

Nothing surfaced. The test timing check (`< 1000` ms against a 5000 ms timeout) is the only wall-clock assertion.
