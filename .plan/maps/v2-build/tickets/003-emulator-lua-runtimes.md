---
type: research
blocked_by: []
assets: [../assets/003-emulator-lua-runtimes.md]
---

# Emulator Lua runtimes

## Question

Which Lua version and standard library do mGBA's scripting engine and BizHawk's Lua host embed, on Windows, Linux and macOS? Can one protocol core written for stock Lua 5.4 run unchanged in both?

Bridge tests in CI run the shared protocol core under stock Lua with a fake shim. That is only valid if the emulators run the same language. Check the integer division and bitwise operators, `string.pack`/`string.unpack`, integer vs float semantics, `utf8`, `require` and module loading, and anything sandboxed or removed. For BizHawk, cover NLua/KeraLua on Windows and on Linux (Mono). Also record each emulator's socket API surface that a shim must wrap: connect/listen, non-blocking reads, and per-frame callbacks. Give the exact apt/brew/choco package or `setup-lua` action version CI should install to match.

Use the emulators' source repos and official docs for the latest stable releases. The [Emulator memory access APIs](../../v2-rebuild/tickets/001-emulator-memory-access.md) findings are a starting point.
