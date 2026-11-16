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

## Answer

The bridge adapter, its strict wire schemas, the mGBA shim and its build step are built. The adapter is `server/src/adapter/bridge/adapter.ts`, with `probe`, `hold` and `live` modes, the two-step hello check, game epochs, batched reads, read timeouts, backoff reconnect, and the `status.adapter.bridge` and `problem` values. The shim is `bridges/src/mgba-shim.lua`, marked untested, and `bridges/src/build.ts` joins the core and shim into one `mgba.lua` with the host and port written in. `checkSettings` rejects hostnames and every all-zero address.

Tests run against the TypeScript fake bridge and against the Lua core over TCP, and cover connect, the hello mismatch, a ROM change, timeouts and reconnect. All four checks passed on PR #7. The haiku audit approved in round 2.

Decisions are in [the report](../assets/007-mgba-bridge-and-adapter-report.md). A RAM request over the caps returns `timeout` and logs once a minute, as amendment 026 says, and the decoder-fit test belongs to [Check batch caps at profile load](./030-batch-caps-at-profile-load.md). Probes keep backing off and only a live connection resets the backoff. The shim's domain offsets, checksum format and paused polling are unverified until [First live run on mGBA](./011-first-live-run-mgba.md). Build output is not yet served at `/bridges/<name>.lua` or written to the data folder at startup, which is a new ticket.
