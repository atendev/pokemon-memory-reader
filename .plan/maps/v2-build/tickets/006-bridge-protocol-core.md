---
type: task
blocked_by: [002, 003, 004]
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
