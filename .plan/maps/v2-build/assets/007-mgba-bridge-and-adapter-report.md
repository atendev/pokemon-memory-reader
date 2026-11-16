# Decision report: mGBA bridge and adapter

Ticket: [mGBA bridge and adapter](../tickets/007-mgba-bridge-and-adapter.md). Branch `t3/mgba-bridge-adapter-1`. The audit approved in round 2 of 5. The implementer and the main thread are the same thread here, and the auditor is one haiku subagent kept across both rounds. No grilling happened, so no user decisions were needed.

## What was built

- `server/src/adapter/bridge/adapter.ts`: `createBridgeAdapter` with `probe`, `hold` and `live` modes, the hello timer, problems, a game epoch, one request slot, ROM splitting, read timeouts, backoff reconnect and a keepalive.
- `server/src/adapter/bridge/messages.ts`: strict Zod checks `checkHello` (two steps, spec §4.7), `parseGame` and `parseError`.
- `server/src/adapter/types.ts`, `clock.ts`, `log.ts`: copied from the interfaces 004 sketch.
- `bridges/src/mgba-shim.lua` (marked untested) and `bridges/src/build.ts` (`buildBridge`, `checkSettings`), with `bridges/test/mgba_stub.lua` as a stub emulator.
- Tests in `server/test/bridge/`: the TypeScript fake bridge, the real Lua core over TCP, and the generated `mgba.lua` run under the stub.

Local result: lint, typecheck and 156 tests pass under Lua 5.4. Lua 5.3 is not installed on this machine, so the 5.3 job runs only in CI.

## Decisions

| # | Question | Options | Choice | Made by | Audit |
|---|---|---|---|---|---|
| 1 | Do `ManagedAdapter` reads work in probe or hold mode? | Allow them, or fail them as `disconnected` | Fail as `disconnected`. A bridge serves one client, and a probe or held connection must send nothing (spec §4.7). | Implementer | Approved |
| 2 | When does a probe close? | Right after the hello frame, or after every frame in the hello chunk | After the frames of the hello chunk are processed, so a `busy` that follows the hello in the same chunk is still seen. | Implementer | Round 1 asked for a test. A probe-with-busy test was added. Approved. |
| 3 | What does a refused TCP connect do to `problem` and `bridge`? | Keep the last values, or clear them | Clear both. Nothing is listening, so an old problem would mislead (spec §4.7). | Implementer | Round 1 asked for a test with a prior problem. Added. Approved. |
| 4 | How long does `bridge_error` last across a reconnect? | Clear on reconnect, or until a valid game message | Until a valid game message on the new connection (spec §4.7). A valid hello alone does not clear it. | Implementer | Round 1 asked for a test. Added. Approved. |
| 5 | What does a RAM request over the caps return? | `timeout`, or a new non-stall failure | `timeout`, logged at error level at most once a minute with the request's range count and byte total. Amendment 026 decides this: the read loop counts it toward `stalled`, and `status.adapter.problem` does not change. | Auditor raised it in round 1. Main thread kept the decision with the citation. | Accepted in round 2 |
| 6 | Who tests that decoder reads fit the caps (spec §4.4)? | This ticket, or the profile-load ticket | [Check batch caps at profile load](../tickets/030-batch-caps-at-profile-load.md), as amendment 026 says caps are checked at profile load. | Main thread | Accepted in round 2 |
| 7 | How are ROM reads over the caps split? | Fill ROM first, or fill the RAM request first | Fill the RAM request first, then add ROM ranges and split those that do not fit. RAM is never split (spec §4.4). | Implementer | Approved. A 150,000-byte ROM read gives 3 requests. |
| 8 | When does reconnect backoff reset? | On every valid hello, or only when live | Only in `live` mode after a valid hello from the right bridge, or on `setMode("live")` with a clean open connection. Probes keep backing off (500 ms, 1 s, 2 s, up to the cap). | Auditor found it in round 1. Main thread fixed it. | Approved in round 2 |
| 9 | Which hosts does `checkSettings` reject? | Three spellings of the wildcard, or every all-zero address | Every all-zero address, including `::0`, `0:0::0`, `0::`, `::%lo` and `::ffff:0.0.0.0`. The check normalises IPv6 through the URL parser. | Auditor found it in round 1. Main thread fixed it. | Approved in round 2 |
| 10 | How does the bind-retry test control time? | Real clock, or a fake `os.time` in the stub | The stub overrides `os.time` and moves it by `STUB_TICK` seconds a frame. The test asserts the order bind, step, bind, step. | Auditor found it in round 1. Main thread fixed it. | Approved in round 2 |
| 11 | What does the shim assume about the mGBA API that nobody has run? | Block on a real emulator, or list the assumptions in the shim header | List them: domain offsets, checksum format and paused polling. The file is marked untested, and the real smoke test belongs to [First live run on mGBA](../tickets/011-first-live-run-mgba.md). | Main thread, per the ticket | Approved |

## Audit trail

- Round 1: five problems. Wildcard spellings (fixed), over-caps handling (kept, with the 026 citation and a rate-limited log), backoff reset on every hello (fixed), three claims without tests (tests added), and a stub test that depended on the real clock (fixed).
- Round 2: approved. One non-blocking note: the probe-with-busy test assumes the hello and busy frames arrive in one TCP read. The fake bridge writes them in one `socket.write`, and the test passed in three repeat runs.

## Not covered

- The shim has not run in mGBA. Domain names, sizes, checksum format and polling while paused are assumptions until the first live run.
- Build output is not wired to startup or to the `/bridges/<name>.lua` route. That belongs to the config and delivery work, so it is a surfaced ticket.
- The Lua 5.3 job has not run for this branch.
