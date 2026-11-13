# Emulator Lua runtimes

Research for ticket 003. Checked on 2026-11-13. Emulator sources are read at tags `0.10.5` (mGBA, 2025-03-09, the latest release) and `2.11.1` (BizHawk). Claims marked **inferred** or **unverified** were not confirmed in a primary source.

## Summary

| | mGBA 0.10.5 | BizHawk 2.11.1 |
|---|---|---|
| Lua version | Whatever Lua the build links. The source supports 5.1 to 5.4 and does not pin one. Release binaries link the Lua from their package manager at build time (**inferred**: 5.4.x) | Windows: bundled `lua54.dll` (Lua 5.4). Linux: system `liblua5.4`, falling back to `liblua5.3`. macOS: no build |
| Standard library | Full (`luaL_openlibs`) | Full (`luaL_openlibs`) |
| Sandbox | None | None |
| Sockets | Own `socket` API, non-blocking, polled on `frame` | LuaSocket via `require`. `core.dll` ships for Windows only |
| Per-frame hook | `callbacks:add("frame", fn)` | `emu.frameadvance()` loop in a coroutine, or `event.onframestart` / `event.onframeend` |

## mGBA

### Lua version

- The CMake build finds a system Lua through `find_feature(USE_LUA "Lua" ...)` and defines `LUA_VERSION_ONLY` from whatever it finds. The Debian package depends on `liblua${LUA_VERSION_MAJOR}.${LUA_VERSION_MINOR}-0`. Nothing pins a version. Source: [CMakeLists.txt @0.10.5, lines 776-786](https://github.com/mgba-emu/mgba/blob/0.10.5/CMakeLists.txt).
- The engine guards code with `LUA_VERSION_NUM < 502` and `< 503` (shims for `lua_pushinteger`, `luaL_register`, integer handling). So mGBA compiles against 5.1 to 5.4, and master has the same guards. Sources: [lua.c @0.10.5](https://github.com/mgba-emu/mgba/blob/0.10.5/src/script/engines/lua.c) (lines 212, 388, 638, 868, 1288), [lua.c @master](https://github.com/mgba-emu/mgba/blob/master/src/script/engines/lua.c).
- The official build recipes take Lua from package managers: Windows AppVeyor `vcpkg ... install ... lua ...`, MSYS2 `${MINGW_PACKAGE_PREFIX}-lua`, macOS `brew install ... lua`. Sources: [.appveyor.yml @0.10.5](https://github.com/mgba-emu/mgba/blob/0.10.5/.appveyor.yml), [README.md @0.10.5, build section](https://github.com/mgba-emu/mgba/blob/0.10.5/README.md).
- **Inferred:** the 0.10.5 binaries (built March 2025) therefore link Lua 5.4.x, since that was current in vcpkg and Homebrew then. No primary source states the shipped `_VERSION`. The docs say only "Currently, only Lua scripting is supported" and are generated from 0.10.2 ([scripting docs](https://mgba.io/docs/scripting.html)).
- **Risk for the next mGBA release:** the vcpkg `lua` port is now 5.5.1 ([vcpkg ports/lua/vcpkg.json](https://github.com/microsoft/vcpkg/blob/master/ports/lua/vcpkg.json)) and Homebrew `lua` is 5.5.1 ([formulae.brew.sh](https://formulae.brew.sh/api/formula/lua.json)). A release or nightly built today could embed 5.5. `lua@5.4` is still 5.4.9 on Homebrew. The spike should read `_VERSION` in each build the docs name.
- Evidence that scripts may use 5.3+ syntax: mGBA's own bundled example uses `keys & (1 << (i - 1))` ([res/scripts/socketserver.lua @0.10.5](https://github.com/mgba-emu/mgba/blob/0.10.5/res/scripts/socketserver.lua)). That is a 5.3+ operator pair. The same repo also compiles against 5.1, so it is not proof for every distro build.

### Standard library and sandbox

- `luaL_openlibs` runs with no removals, so `base`, `package`, `coroutine`, `table`, `io`, `os`, `string`, `math`, `utf8` (5.3+), and `debug` are present. Source: [lua.c @0.10.5, line 385](https://github.com/mgba-emu/mgba/blob/0.10.5/src/script/engines/lua.c).
- No sandbox is applied. I found no code that removes or wraps `io`, `os` or `package`.
- `require`: the engine wraps `require` (`_luaRequireShim`). While a script loads, it prepends the script's own directory to `package.path` (`<dir>/?.lua;<dir>/?/init.lua`) and `package.cpath`, then restores the old paths. A multi-file bridge can `require` siblings, but the build step should still produce a single `mgba.lua`. Source: [lua.c @0.10.5, lines 1342-1400](https://github.com/mgba-emu/mgba/blob/0.10.5/src/script/engines/lua.c).
- Integers: the engine maps Lua integers to S64 when `LUA_VERSION_NUM >= 503` and `lua_isinteger`, else F64. Values handed to `emu:read*` and friends are integers. Source: [lua.c @0.10.5, line 638](https://github.com/mgba-emu/mgba/blob/0.10.5/src/script/engines/lua.c).

### Socket API surface a shim must wrap

The `socket` global is defined in Lua source embedded in `lua.c` (`_socketLuaSource`), over a C `mScriptSocket` class. Sources: [lua.c @0.10.5, lines 61-190](https://github.com/mgba-emu/mgba/blob/0.10.5/src/script/engines/lua.c), [socket.c @0.10.5](https://github.com/mgba-emu/mgba/blob/0.10.5/src/script/socket.c), [scripting docs](https://mgba.io/docs/scripting.html).

| Need | API | Behaviour |
|---|---|---|
| Listen | `local s, err = socket.bind(address_or_nil, port)`, then `s:listen([backlog])` | `bind` opens the socket and sets it non-blocking. `nil` or `""` address means no explicit bind address (`SocketOpenTCP(port, NULL)`). A non-empty address goes through `SocketResolveHost`, so a hostname or IP works. `listen` defaults the backlog to 1 |
| Accept | `local c, err = s:accept()` | Non-blocking, the client socket is non-blocking. On failure returns `nil, err` |
| Connect | `socket.connect(address, port)` | **Blocking.** The docs say "The emulator will not respond until the connection either succeeds or fails". The resulting socket is then non-blocking |
| Read | `local data, err = c:receive(maxBytes)` | Non-blocking. Returns `nil, socket.ERRORS.AGAIN` when no data. Returns `nil, "disconnected"` when the peer closed (recv returned 0). It is **not** LuaSocket's `receive` (no `"*l"` or line mode; the source has a TODO saying so) |
| Write | `local n, err = c:send(data [, i [, j]])` | Non-blocking, may be partial. Returns the byte count, or `i + n - 1` when `i` is given. Keep a send buffer |
| Poll | `c:hasdata()`, `c:poll()` | `hasdata` does a zero-timeout select. `poll` dispatches `received` or `error` callbacks |
| Callbacks | `c:add("received", fn)`, `c:add("error", fn)`, `c:remove(id)` | Callbacks run as `fn(socket, ...)` inside `pcall`. Errors print to the console and do not propagate |
| Close | `c:close()` | Also removes the per-socket `frame` hook |
| Errors | `socket.ERRORS.AGAIN`, `ADDRESS_IN_USE`, `CONNECTION_REFUSED`, `DENIED`, ... | `bind` returns `nil, err` where `err` is a name resolved through `socket.ERRORS`, so compare with `err == socket.ERRORS.ADDRESS_IN_USE` as the bundled example does |

Event delivery: `_hook` registers `callbacks:add('frame', function() self:poll() end)` when a socket is bound, listening or connected. Socket events are therefore checked once per emulated frame, matching the docs ("Events get checked once per frame but can be checked manually"). **Whether `frame` callbacks, and so socket polling, fire while the emulator is paused is not stated in any source I read**, and the ticket 022 spike must test it. A bridge can call `s:poll()` or `s:accept()` and `receive` directly from any other callback it has, but no callback is documented to run while paused.

The unresolved bind retry in the ticket 022 notes matches the bundled example, which treats `ADDRESS_IN_USE` as a normal result.

### Other mGBA callbacks

`callbacks:add(name, fn)` accepts `alarm`, `crashed`, `frame`, `keysRead`, `reset`, `savedataUpdated`, `sleep`, `shutdown`, `start`, `stop`. `console:log`, `console:warn` and `console:error` print to the scripting console. Source: [scripting docs](https://mgba.io/docs/scripting.html).

## BizHawk

### Lua version and loading

- BizHawk 2.11.1 carries its own NLua fork in-tree (`ExternalProjects/NLua`, `netstandard2.0`). It does not use the NuGet KeraLua package. It loads the native Lua library by name at runtime and records whether it is 5.3 (`IsLua53`). Source: [LuaNativeMethodLoader.cs @2.11.1](https://github.com/TASEmulators/BizHawk/blob/2.11.1/ExternalProjects/NLua/src/Native/LuaNativeMethodLoader.cs), [LuaNativeMethods.cs @2.11.1](https://github.com/TASEmulators/BizHawk/blob/2.11.1/ExternalProjects/NLua/src/Native/LuaNativeMethods.cs).
- Windows: loads `lua54.dll`. The repo ships `Assets/dll/lua54.dll`. Lua 5.4.
- Linux (and BSD): tries `liblua.so.5.4`, `liblua-5.4.so`, `liblua5.4.so`, `liblua5.4.so.0`, `liblua5.4.so.5.4`, then the same names for 5.3. The source comment says: "we want to use the system lua library but old (but not yet EOL) distros may not have lua 5.4 ... we can safely use lua 5.3 for our purposes". So a Linux user may run 5.3. The README lists "Lua 5.4" among Linux runtime dependencies, with Mono "complete". Sources: LuaNativeMethodLoader.cs (above), [README.md @2.11.1](https://github.com/TASEmulators/BizHawk/blob/2.11.1/README.md).
- macOS: the loader names `liblua54.dylib`, but 001 records that BizHawk has no macOS build, so macOS is out of scope for BizHawk.
- The mGBA core inside BizHawk is irrelevant to the Lua version: Lua belongs to EmuHawk, not the core.

### Standard library and sandbox

- `LuaState` opens the default libs (`luaL_openlibs`) in the constructor. Source: [LuaState.cs @2.11.1](https://github.com/TASEmulators/BizHawk/blob/2.11.1/ExternalProjects/NLua/src/Native/LuaState.cs).
- `LuaSandbox` only manages the current working directory for a script. `EnvironmentSandbox` is a stub. Neither removes libraries. Sources: [LuaSandbox.cs @2.11.1](https://github.com/TASEmulators/BizHawk/blob/2.11.1/src/BizHawk.Client.Common/lua/LuaSandbox.cs), [EnvironmentSandbox.cs @2.11.1](https://github.com/TASEmulators/BizHawk/blob/2.11.1/src/BizHawk.Client.Common/lua/EnvironmentSandbox.cs). `print` is replaced by a host function.
- `require`: BizHawk prepends its `Lua` folder to `package.path` and `package.cpath` (`.so` on Unix, `.dll` on Windows). Source: [LuaLibraries.cs @2.11.1, lines 107-124](https://github.com/TASEmulators/BizHawk/blob/2.11.1/src/BizHawk.Client.Common/lua/LuaLibraries.cs).
- The `luanet` .NET bridge is also loaded into the script state. Scripts can reach .NET classes through it. The core must not touch it.
- `string.pack`, `string.unpack`, `utf8`, `//` and the bitwise operators are standard Lua 5.3 features, so they are available on both 5.3 and 5.4.

### Socket API surface

- **Built-in `comm.socketServer*`**: BizHawk's own API, with the EmuHawk process connecting out as a client to `--socket_ip` and `--socket_port`. Its surface is in [comm.d.lua @2.11.1](https://github.com/TASEmulators/BizHawk/blob/2.11.1/Assets/Lua/_docs_luacats/comm.d.lua). 001 recommends against it.
- **LuaSocket**: the repo ships only `Assets/Lua/socket/core.dll` (Windows). There is no `socket.lua` wrapper and no Linux `.so` in the tree. Source: tree listing of [BizHawk @2.11.1](https://github.com/TASEmulators/BizHawk/tree/2.11.1/Assets/Lua/socket). So `require("socket.core")` works on Windows. A script that does `require("socket")` needs a `socket.lua` beside it; Archipelago ships its own copy and calls `require("socket")` ([connector_bizhawk_generic.lua @0.6.3, line 289](https://github.com/ArchipelagoMW/Archipelago/blob/0.6.3/data/lua/connector_bizhawk_generic.lua)). **Linux LuaSocket availability is unverified.** BizHawk adds `<Lua dir>/?.so` to `cpath`, so a user could drop a LuaSocket `.so` built for the matching Lua version there, but nothing ships. This is the open item that ticket 022 already records, with the fallback "BizHawk on Linux is unsupported for now".
- LuaSocket usage pattern (Archipelago): `server:bind("localhost", port)`, `server:listen(0)`, `server:settimeout(0)`, `server:accept()` returning `client, "timeout"`, `client:settimeout(0)`, `client:receive()` returning `nil, "timeout"`, `client:send(str)`. Source: connector_bizhawk_generic.lua (above), lines 556-613.
- Unlike mGBA, `receive` here is the real LuaSocket `receive` (line mode by default, with a pattern or byte count argument). A shim written for both must wrap this difference.

### Per-frame execution

- Scripts run as a coroutine. A script that must keep working loops with `emu.frameadvance()`, or registers `event.onframestart` / `event.onframeend`. Archipelago builds a coroutine and calls `coroutine.resume` from a callback, then loops `emu.frameadvance()`. For GB, GBC and SGB it registers `event.onmemoryexecute(tick, 0x40, ...)` instead, because a Gambatte setting can misalign execution (BizHawk issue 3711). Source: connector_bizhawk_generic.lua lines 590-680.
- A script that never yields freezes EmuHawk. While the emulator is paused, `emu.frameadvance()` does not return until the next frame, so BizHawk serves requests only on frames or while a script runs in a non-frame callback. **Pause behaviour is unverified here.**

## Cross-checks on portable constructs

Language differences relevant to one core running on 5.3, 5.4, and possibly 5.5:

- Lua 5.4 removed string-to-number coercion from the core arithmetic and bitwise operators (the string library handles arithmetic coercion; bitwise operators do not coerce). Never pass strings to arithmetic or bitwise operators. Source: [Lua 5.4 manual, section 8.1 and 3.4.3](https://www.lua.org/manual/5.4/manual.html#8).
- 5.4 changed integer `for` loop edge cases (the loop never wraps) and made overflowing decimal literals read as floats. Source: same.
- 5.4 `print` no longer calls `tostring`, and `math.random` seeds randomly. 5.4 `utf8` decoders reject surrogates by default. Source: same, section 8.2.
- Lua 5.5 makes `global` a reserved word and makes the `for` control variable read-only. Source: [Lua 5.5 manual, section 8.1](https://www.lua.org/manual/5.5/manual.html#8).

## Recommendation for CI

- **Lua version:** run the core tests under stock **Lua 5.4**, and also under **5.3** if cheap, because BizHawk on Linux may fall back to 5.3. Both are valid targets for the same source.
- **Install method:** use `leafo/gh-actions-lua@v13` with `luaVersion: "5.4"` (the README lists the aliases `5.1` to `5.5` and full versions such as `5.4.9`) on Linux. On Windows runners the action needs `step-security/msvc-dev-cmd@v1` first. For a distro install, use `apt-get install lua5.4` on Ubuntu or Debian (Debian ships 5.4.4 in bookworm and 5.4.7 to 5.4.9 in newer suites; run `apt-cache policy lua5.4` for the Ubuntu runner's exact version) and `brew install lua@5.4` on macOS (5.4.9). **Do not use plain `brew install lua`, `choco`, or `vcpkg install lua` for this check: Homebrew and vcpkg `lua` are now 5.5.1.**
- **One core in both emulators:** yes, with the constraints below. Both embed a full standard library on Lua 5.3 or later, and both expose `string.pack` and `string.unpack`, `//`, the bitwise operators, and `utf8`. The core must stay inside the 5.3/5.4 intersection and avoid the 5.5 breaks.
- **Constructs to avoid in the core:**
  - Strings as operands of arithmetic or bitwise operators.
  - 5.4-only syntax and functions: `<const>`, `<close>`, `warn`, the new `collectgarbage` options.
  - `global` as an identifier, and assigning to a `for` control variable (5.5).
  - Any use of `os`, `io`, `debug`, `package` or `require` of sibling files. The built file must be self-contained. Neither emulator sandboxes these, but the `require` path differs.
  - `print` as the only output route (BizHawk replaces it, mGBA's goes to the console natively): the shim should own logging (`console:log` vs `print`).
  - Reliance on `math.random` seeding, `tostring` of floats (`1e15` vs `1e+15`), and `pairs` iteration order, since the core produces framed binary or JSON output.
  - `luanet` and any emulator globals in the core. Keep them in the shims.
  - A single float-vs-integer trap: values from mGBA and BizHawk APIs should be passed through `math.tointeger` or `//`-based arithmetic before `string.pack("<I4", ...)`, because `string.pack` raises "number has no integer representation" on floats with fractional parts.
- **The shim must wrap these differences:** mGBA `socket.bind`/`accept`/`receive`/`send` (non-blocking, polled on `frame`, `receive(n)` only, `"disconnected"` on close) against LuaSocket (`settimeout(0)`, `"timeout"`, line-mode `receive`); `console:log` against `print`; `callbacks:add("frame", ...)` against an `emu.frameadvance()` coroutine; and mGBA's `emu:readRange(offset, len)` against BizHawk's domain-based `memory.read_bytes_as_array`.
- **Open for spikes, not resolved by sources:** the shipped mGBA `_VERSION` on Windows, Linux and macOS; whether mGBA runs `frame` callbacks and so socket polling while paused; whether BizHawk on Linux can load LuaSocket; and whether any mGBA release after 0.10.5 moves to Lua 5.5.
