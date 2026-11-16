---
type: task
blocked_by: [006, 013, 026]
claimed_by: wayfinder-master v2-build-master-1794792924
claimed_at: 2026-11-16T01:36:35Z
---

# mGBA bridge and adapter

## Question

Build the mGBA shim and the TypeScript bridge adapter that talks to any bridge. Follow the adapter and bridge sections of the spec.

- **mGBA shim:** socket calls, mapping emulator memory to the shared domain names, game info and frame callbacks, using the API surface recorded in Emulator Lua runtimes. The program writes the configured host and port into the bridge.
- **Bridge adapter:** connect to port 7426, the hello and protocol version check, game-change events, batched reads, read timeouts, reconnect, and the `status.adapter.bridge` and `problem` fields.
- **Tests:** run against the TypeScript fake bridge and against the Lua core with its fake shim. The shim itself can't run in CI. Mark it untested in the shim file and leave the real smoke test to First live run on mGBA.

## Acceptance

- Adapter tests cover connect, the hello mismatch, a ROM change, timeouts and reconnect.
- CI is green.

## Handoff

Branch `t3/mgba-bridge-adapter`. Last audit round: 0 (no auditor started yet). Context hit the 150k limit after implementation. Local state: `bun run lint`, `bun run typecheck` and `LUA_BIN=lua5.4 bun test` are green (146 tests).

Done:
- `server/src/clock.ts`, `log.ts`, `adapter/types.ts` copied from the interfaces 004 sketch.
- `adapter/bridge/messages.ts`: strict Zod checks `checkHello` (two-step, spec §4.7), `parseGame` (drops unknown domains), `parseError`.
- `adapter/bridge/adapter.ts`: `createBridgeAdapter` with probe/hold/live modes, hello timer, problems, game epoch, one request slot, rom splitting, timeouts, backoff reconnect, keepalive.
- Tests in `server/test/bridge/`: `adapter.test.ts` (TS `fake-bridge.ts` plus `manual-clock.ts`), `adapter-lua.test.ts` (real Lua core over TCP), `mgba-build.test.ts`.
- `bridges/src/mgba-shim.lua` (marked untested), `bridges/src/build.ts` (`buildBridge`, `checkSettings`), `bridges/test/mgba_stub.lua`.

Left, in order:
1. Start one haiku auditor, send ticket question, map Notes/Decisions and the full diff. Iterate to APPROVE, up to five rounds.
2. Check the CI Lua 5.3 job still passes (`bun test server/test/bridge` uses default `lua`).
3. Write `.plan/maps/v2-build/assets/007-mgba-bridge-and-adapter-report.md` (decisions below), unslop it, commit.
4. Push without force, open a PR against `wayfinder/v2-build-master`, link it, return PUSHED.
5. On CI green, record the resolution in this ticket (delete this section), commit, push, return DONE.

Decisions to report: no `ManagedAdapter` reads in probe or hold mode; a probe closes after the frames of the hello chunk are processed, so `busy` after the hello is still seen; refused connect clears problem and bridge; bridge_error survives reconnect until a valid game message; RAM over caps returns `timeout`; ROM split fills the RAM request first; shim assumptions are listed in the shim header (domain offsets, checksum format, paused polling).

Surfaced candidates: build step output is not yet wired to startup or `/bridges/<name>.lua` (belongs to the config/delivery work).

Read first: `server/src/adapter/bridge/adapter.ts`, `server/test/bridge/adapter.test.ts`, `bridges/src/mgba-shim.lua`.
