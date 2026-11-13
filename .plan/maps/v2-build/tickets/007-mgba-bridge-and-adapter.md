---
type: task
blocked_by: [006]
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
