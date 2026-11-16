---
type: task
blocked_by: [002, 003, 004]
claimed_by: wayfinder-master v2-build-master-1794786410
claimed_at: 2026-11-15T23:46:50Z
---

# Bridge protocol core

## Question

Implement the bridge wire protocol on both sides and prove in CI that they agree. Follow the bridge wire protocol section of the spec.

- **Lua:** the shared protocol core in `bridges/`, with framing, dispatch, the small JSON encoder, the request checks and the protocol constant, plus a fake shim that serves memory domains from in-memory buffers.
- **TypeScript:** the frame codec, message types and error codes, in the package that Core module interfaces names.
- **CI:** install Lua 5.4 with `leafo/gh-actions-lua`, plus a 5.3 run if it's cheap, as [Emulator Lua runtimes](./003-emulator-lua-runtimes.md) recommends. Bun tests start the Lua core with the fake shim over real TCP. They cover hello, game messages, batched multi-range reads up to the 64 KiB cap, every one of the seven error codes, and one request in flight.

## Acceptance

- CI is green with the cross-language tests running.
- A deliberately broken frame on either side fails a test.

## Answer

The bridge wire protocol is built on both sides and CI proves they agree. The Lua core is `bridges/src/core.lua`, with a fake shim and a stdin/stdout harness in `bridges/test/`. The TypeScript codec, constants and message types are in `server/src/adapter/bridge/`. Bun tests open real TCP connections and pass each connection's bytes to the Lua core one command at a time, because stock Lua has no sockets. They cover hello, game messages, batched reads up to the 64 KiB cap, all seven error codes and ordered id echo for one request in flight.

CI installs Lua 5.4 with `leafo/gh-actions-lua` in `check` and runs the bridge tests under Lua 5.3 in a separate `bridge-lua-5-3` job. All four checks passed on PR #5. Mutation runs show a broken frame fails a test on either side. The haiku audit approved in round 3.

Decisions are in [the report](../assets/006-bridge-protocol-core-report.md). Spec gaps it settled: a READ body whose length disagrees with its range count is `bad_frame` with id 0 and a close, an empty READ gets an empty DATA reply, and HELLO, GAME, DATA or ERROR sent to the bridge is `unknown_kind`. Zod schemas for JSON bodies wait for the bridge adapter ticket.
