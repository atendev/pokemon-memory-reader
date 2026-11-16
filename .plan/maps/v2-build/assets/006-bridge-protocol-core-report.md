# Bridge protocol core: decision report

Ticket: [Bridge protocol core](../tickets/006-bridge-protocol-core.md). Branch `t3/bridge-protocol-core`. The main thread implemented it as a child of wayfinder-master, in auto mode. A haiku auditor reviewed it. The implementer made every decision below unless the "Who" line says otherwise. The repo has no `workflow.md`, `AGENTS.md` or `CLAUDE.md`, so the runner's steps apply with the master's overrides: the commit gate commits without asking, and `map.md` is untouched.

## Where things live

The Lua core is `bridges/src/core.lua`. The fake shim and the stdin/stdout harness are in `bridges/test/`. The TypeScript codec is `server/src/adapter/bridge/{constants,wire,messages}.ts`, as Core module interfaces 004 names it. `internal/src/memory.ts` adds the `Domain` and `Platform` types the constants check against, as 004's next-step note asks. The root `tsconfig.json` gains an `internal/*` path alias, the same way `api/*` works, and `server` depends on `internal` through `workspace:*`.

## Decisions

**How the tests get real TCP.** The options were LuaSocket in the fake shim, or a Bun TCP relay in front of a stdio-driven Lua process. Stock Lua has no sockets, `leafo/gh-actions-lua` installs no LuaSocket, and the owner's machine has none. I chose the relay. The Bun tests open real TCP listeners and clients, and pass each connection's bytes to the Lua harness one command at a time, with the harness answering `done` after each. The fake shim fakes the socket calls, which the spec already assigns to the shim. Nothing in the protocol core is faked. A LuaSocket install would add a second pinned CI action for no extra coverage of the core.

**Check order inside a READ.** Parse the body (`bad_frame`), then `no_game`, then `too_large`, then `bad_range`. A body whose length disagrees with its range count is `bad_frame` with id 0, followed by a close, because the bridge can't parse it. The spec doesn't say which error that is. A count above 512 can't reach `too_large`, because its body already exceeds the 4,610-byte READ limit and fails as a bad frame at the header, as spec §4.2 says. `too_large` therefore fires only on more than 64 KiB of data.

**Empty read.** A READ with zero ranges is valid and gets an empty DATA reply. The spec is silent.

**Kinds.** A kind outside 1 to 5 is `bad_frame`. HELLO, GAME, DATA or ERROR sent to the bridge is `unknown_kind` with the frame's id and the connection stays open, up to each kind's own body limit.

**Game change detection.** `shim.game()` must return the same table until the game changes. The core compares by reference first and by encoded body second, so a per-frame call stays cheap. The core polls before it reads, so the GAME frame always precedes the reply to a read on the new ROM (spec §4.3). The new-connection path sends the hello, then the current game.

**Busy.** A second connection gets the hello, then `busy` with id 0, then closes once its send buffer drains. The first client is unaffected. Both tests pass.

**Errors outside a handler.** The whole step runs under `pcall`. A failure outside a request handler is logged and closes the client. A failure in a handler answers that request with `internal`, and the message is cut until the body fits 4 KiB (tested with a 10 KB message).

**Send buffer, bind retry and logging.** Partial sends are kept in a send buffer (tested at 1,500 bytes per call against a 64 KiB reply). A failed bind logs and retries every 2 seconds on the shim's clock (tested with a fake clock). The core logs only "listening", bind errors, and the start and end of a serving session. The session starts at the first READ, not at connect (tested).

**JSON encoder.** It handles strings, booleans, integers, finite floats, a `null` sentinel, arrays and sorted string-keyed objects. A string that isn't UTF-8 is read as Latin-1 so the output stays valid JSON. There is no decoder.

**Zod schemas deferred.** `messages.ts` holds TypeScript types, `encodeJsonBody` and `decodeJsonBody`. The strict Zod schemas of spec §4.7 belong to the bridge adapter ticket, and Zod isn't a dependency yet.

**TS helpers beyond the ticket.** `decodeReadBody` and `createRequestIds(after)` are in `wire.ts` for the FakeBridge and adapter tickets. The id generator starts at 1, skips 0 on wrap, and takes a start value so the wrap is testable.

**CI.** The `check` job installs Lua 5.4 with `leafo/gh-actions-lua` v13.1.0, pinned to its commit SHA like the other actions. A separate `bridge-lua-5-3` job runs `bun test server/test/bridge` under Lua 5.3, which is cheap because it skips lint and typecheck. `lua` is the binary name on the runner. Locally `lua` is 5.5.1, so the tests read `LUA_BIN`, and the version test accepts only 5.3 and 5.4.

**Test scope.** `server/tsconfig.json` now includes `test/`, so the cross-language tests are typechecked.

## Evidence

All 46 tests pass locally under Lua 5.4, with typecheck and Biome clean. Lua 5.3 runs only in CI. Mutations confirmed that a broken frame fails on either side: a Lua frame length off by one fails 29 of 32 bridge tests, a renamed Lua error code fails 1, a TS id off by one fails 19, a TS length check one byte looser fails 1, and a changed constant fails 4.

## Audit

Haiku auditor, one subagent for every round. The verdict and rounds are recorded below.
