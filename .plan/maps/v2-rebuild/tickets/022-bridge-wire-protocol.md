---
type: grilling
blocked_by: [001]
assets: []
---

# Bridge wire protocol

## Question

What do the program and the mGBA and BizHawk Lua bridges say to each other over the socket?

Decide the transport and default port per bridge, message framing, the hello (bridge name, bridge protocol version as an integer separate from the app version, emulator and version, and the game code and CRC32 where the emulator gives them), the read request shape (batched domain, offset and length, per [Emulator memory access APIs](./001-emulator-memory-access.md)), error replies, and how the adapter treats a bridge that sends no hello or a different protocol version. Bridge reply validation uses Zod in `server/`, per [Importable package for overlay developers](./015-importable-package.md).

Input from [Release pipeline](./017-release-pipeline.md): the adapter refuses a protocol mismatch, and a bridge with no hello is reported as an unknown bridge. In both cases `status` lets the viewer tell the user to reload the bridge from the data-folder path or the `/bridges/<name>.lua` download. The protocol integer bumps only on wire changes.

Input from [Read loop and latency budget](./018-read-loop.md): the read request is a list of ranges answered in one reply from one logical sample. Every request carries an id the reply echoes, and the adapter discards a late reply that arrives after its 250 ms timeout. A bridge keeps its socket open while the emulator is paused, and a closed socket is the only disconnect signal for mGBA and BizHawk, as the read loop answer states.

Input from [Config file](./019-config-file.md): each bridge's endpoint is a setting, `adapters.mgba` and `adapters.bizhawk` with `host` (default `127.0.0.1`) and `port`. This ticket sets the two default ports. They must differ from each other, from the app's default 7425 and from RetroArch's 55355.
