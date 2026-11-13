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
