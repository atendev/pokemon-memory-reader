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

## Handoff

Branch `t3/bridge-protocol-core`. Implementation is done and committed as a `wip:` commit. Local: 48 tests pass under Lua 5.4 (`EXPECT_LUA_VERSION=5.4 LUA_BIN=lua5.4 bun test`), typecheck and Biome clean. Lua 5.3 runs only in CI.

Done: `bridges/src/core.lua`, fake shim and harness in `bridges/test/`, the TS codec in `server/src/adapter/bridge/`, cross-language tests in `server/test/bridge/`, CI Lua installs (5.4 in `check`, 5.3 in `bridge-lua-5-3`, with `EXPECT_LUA_VERSION`), and the decision report `assets/006-bridge-protocol-core-report.md`.

Left, in order:
1. Round 3 of the audit with the same haiku auditor (agent a4a9c907cac01a2d6, continue with SendMessage if it is still reachable, else start a new one). The last audit round was 2. Round 2's open objection was that `FrameDecoder.push` delayed a bad frame to the next push. It is fixed: `push` now returns `{ frames, badFrame }` together, with tests and the `lua-bridge.ts` client updated. Ask it to confirm.
2. Add the audit verdict and rounds to the report's Audit section, and note that "one request in flight" is adapter-owned (spec 4.5) so the test shows ordered id echo, and that JSON escape and per-connection id restart are untested at the edges. Run unslop on the report.
3. Push the branch without forcing, open a PR against `wayfinder/v2-build-master` if the repo uses PRs, return PUSHED.
4. On CI green, write `## Answer` into this file, remove this Handoff section, commit, push, return DONE with the Decisions line.

Read first: the report, `bridges/src/core.lua`, `server/src/adapter/bridge/wire.ts`, `server/test/bridge/core.test.ts`.
