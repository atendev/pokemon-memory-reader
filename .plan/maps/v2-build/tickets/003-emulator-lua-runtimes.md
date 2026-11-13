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

## Answer

One protocol core can run unchanged in mGBA 0.10.5 and BizHawk 2.11.1 if it stays within Lua 5.3 and 5.4. mGBA links whatever system Lua the build used (5.1 to 5.4 supported, 5.4 inferred for release builds), with all standard libraries open. BizHawk bundles `lua54.dll` on Windows and uses the system `liblua5.4` on Linux, falling back to 5.3.

The core must avoid:

- Lua 5.5 changes;
- strings as operands to arithmetic or bitwise operators;
- `require` of sibling files (the generated bridge is one file);
- `luanet`;
- emulator globals.

Sockets differ, so each shim wraps its own API. The mGBA shim wraps the non-blocking `socket` polled from the `frame` callback, and the BizHawk shim wraps LuaSocket with `settimeout(0)`.

CI installs Lua with `leafo/gh-actions-lua@v13` and `luaVersion: "5.4"`, and adds a 5.3 run if it's cheap. It doesn't use Homebrew's or vcpkg's plain `lua`, which is now 5.5.

Still open:

- The shipped mGBA binary's `_VERSION`. Its live check is in First live run on mGBA.
- Whether sockets still poll while the emulator is paused. Its mGBA live check is in First live run on mGBA, and BizHawk's waits for the BizHawk bridge work.
- Whether BizHawk on Linux ships LuaSocket. This stays in the map's fog.

Findings: [assets/003-emulator-lua-runtimes.md](../assets/003-emulator-lua-runtimes.md).
