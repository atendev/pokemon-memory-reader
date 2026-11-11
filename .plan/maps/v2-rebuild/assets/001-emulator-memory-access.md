# Emulator memory access APIs

Research for ticket 001. Checked on 2026-11-11 against these releases: mGBA 0.10.5 (2025-03-08), RetroArch 1.22.2 (2025-11-20), BizHawk 2.11.1 (2026-05-01), SkyEmu v5 (2026-02-12), and VBA-M 2.2.3 (2025-10-25). "Master" means the default branch on that date, which may contain unreleased changes. Claims marked **unverified** come from reasoning or secondary knowledge and were not confirmed in a primary source.

## Comparison

| Emulator | Method | Bridge needed | Auto-load possible | Domains and addressing | Latency and granularity | ROM identification | Platforms |
|---|---|---|---|---|---|---|---|
| mGBA standalone 0.10+ | Lua script with `socket` API serving our protocol | Yes (Lua) | Not in 0.10.x (Tools > Scripting by hand). `--script FILE` exists on master and nightlies only | Bus address via `emu:read8/16/32/readRange`, or per-domain offsets via `emu.memory.<domain>`. GBA: `wram` (EWRAM), `iwram`, `cart0..2` (ROM), `bios`, `io`, `vram`, `oam`, `palette`. GB: `wram`, `sram`, `hram`, `cart0`, `vram`, `oam`, `io` | `readRange` returns any length as a string. Script runs on the emulator thread, so a reply waits for the next callback (about one frame, **unverified**) | `emu:getGameCode()`, `emu:getGameTitle()`, `emu:checksum()` (CRC32 default) | Windows, Linux, macOS |
| mGBA GDB stub | GDB remote protocol `m addr,len` over TCP | No | Yes, via a launch flag (`-g`, port 2345 by default, **unverified** for the Qt build) | GBA bus addresses only (stub reads through the ARM core) | Max 512 bytes per `m` packet. Attaching a debugger may halt emulation (**unverified**) | Read header from 0x080000A0 | Windows, Linux, macOS |
| RetroArch 1.22.2 network commands | UDP text commands on port 55355: `READ_CORE_MEMORY <hexaddr> <n>` | No | Yes: launch with `-L core rom --appendconfig file` containing `network_cmd_enable = "true"` | Addresses come from the core's libretro memory map (system bus addresses). See the core table below | One UDP datagram per reply, 3 chars per byte. 1.22.2 has no explicit cap but clamps to the end of one descriptor. Master caps at 16384 bytes and can span regions. Commands are polled in `input_driver_poll`, so once per frame | `GET_STATUS` returns `PLAYING system,basename,crc32=xxxxxxxx` in 1.22.2. Master no longer appends crc32 | Windows, Linux, macOS, others |
| BizHawk 2.11 Lua, `comm.socketServer*` | Lua script; EmuHawk connects out as a TCP or UDP client to our server | Yes (Lua) | Yes: `--lua=script.lua --socket_ip=127.0.0.1 --socket_port=N` | Named domains. GBA (mGBA core): `EWRAM`, `IWRAM`, `ROM`, `SRAM`, `BIOS`, `VRAM`, `OAM`, `PALRAM`, `Combined WRAM`, `System Bus`. GB (Gambatte core): `WRAM`, `ROM`, `CartRAM`, `HRAM`, `VRAM`, `OAM`, `System Bus`. Addresses are domain offsets | `memory.read_bytes_as_array` or `readbyterange` of any length. Script loop runs once per frame (`emu.frameadvance`). Responses must be length-prefixed (since 2.6.2) | `gameinfo.getromhash()`, `gameinfo.getromname()`, or read `ROM` domain header | Windows, Linux x86_64 (Mono). No macOS |
| BizHawk Lua with LuaSocket | Script opens its own TCP server via `require("socket")` (Archipelago model) | Yes (Lua) | Yes: `--lua=script.lua` | Same as above | Same as above | Same as above | BizHawk ships `Assets/Lua/socket/core.dll` (Windows). Linux availability **unverified** |
| BizHawk external tool | .NET DLL using `IMemoryApi` (`ReadByteRange`), any IPC it wants | Yes (C# DLL) | Yes: `--open-ext-tool-dll=Name` | Same domains as Lua | Same per-frame model (**unverified** for ext tools) | `IGameInfoApi` | Windows, Linux (Mono) |
| SkyEmu v5 | Built-in HTTP control server, `GET /read_byte?addr=02000004&addr=...` | No | Yes, headless only: `SkyEmu http_server <port> <rom>`. In the GUI it is a settings toggle | Hex bus addresses with no `0x`. `map` param is for NDS only | Repeat `addr` for more bytes; no stated cap (URL length bounds it) | `/status` returns `rom-path`; header read via bus (**unverified** that ROM reads through `/read_byte`) | Windows, Linux, macOS |
| VBA-M 2.2.3 | GDB remote stub (`gbaRemote.cpp`). A Qt frontend with Lua landed on master in Sept 2026 and is unreleased | No (GDB) | **Unverified** | GBA bus addresses | **Unverified** | Header read | Windows, Linux, macOS |
| NanoBoyAdvance | None. README lists only PPU and sprite viewers | n/a | n/a | n/a | n/a | n/a | Windows, Linux, macOS |
| SameBoy standalone | None found. Has a text debugger, no network API | n/a | n/a | n/a | n/a | n/a | macOS (Cocoa), SDL elsewhere |
| Gambatte standalone | None found (**unverified**) | n/a | n/a | n/a | n/a | n/a | n/a |

### RetroArch core memory maps

`READ_CORE_MEMORY` resolves addresses through `RETRO_ENVIRONMENT_SET_MEMORY_MAPS` descriptors, or falls back to system RAM at address 0 if a core sets no map. All four cores set a map.

| Core | Mapped regions | Notes |
|---|---|---|
| mGBA | IWRAM 0x03000000, EWRAM 0x02000000, SRAM 0x0E000000, ROM 0x08000000 (plus mirrors), BIOS, VRAM, palette, OAM, IO | ROM is readable, so the game code at 0x080000AC works. GB mode maps the GB bus |
| gpSP | IWRAM 0x03000000 (32 KiB), EWRAM 0x02000000 (256 KiB) | No ROM in the map. Identify the game with `GET_STATUS` crc32 or the filename |
| Gambatte | WRAM 0xC000 and 0xD000, HRAM, VRAM, OAM, ROM 0x0000-0x7FFF, SRAM 0xA000, CGB WRAM banks 2-7 at 0x10000 | Header at 0x0134 is readable |
| SameBoy | Same layout as Gambatte, plus IE and IO | Header at 0x0134 is readable |

`READ_CORE_RAM` also exists, but it uses rcheevos achievement addressing and only exists in builds with `HAVE_CHEEVOS`. Master's error text says it needs "a game with achievements" running. Use `READ_CORE_MEMORY` instead. Writes through `WRITE_CORE_MEMORY` pause RetroAchievements hardcore mode.

## Existing tools

| Tool | Emulators | How it connects |
|---|---|---|
| Ironmon-Tracker | BizHawk 2.8+, mGBA 0.10+ | Lua script loaded by hand in the emulator; all logic runs in-emulator, no external program |
| pokebot-gen3 | Its own embedded mGBA | Embeds libmgba through `libmgba-py` (pinned tag 0.2.0-2), so memory reads are in-process. Not an adapter for a user's existing emulator |
| Archipelago | BizHawk | `connector_bizhawk_generic.lua` opens a LuaSocket TCP server on ports 43055-43059. Newline-delimited JSON requests (`READ`, `WRITE`, `GUARD`) with base64 payloads and domain names. Closest prior art for our BizHawk bridge |
| LiveSplit `asr` emulator module | mGBA, RetroArch, VBA/VBA-M, BizHawk, NO$GBA, Mednafen | Raw process memory. See below |
| RetroAchievements | RetroArch, BizHawk (built in), RA emulator forks | In-process via `rcheevos` and the libretro memory map. Not usable from outside |
| PokeFinder | None | Offline RNG calculator; no emulator connection |

## Raw process memory reading

### How tools find emulated RAM

LiveSplit's `asr` crate is the best public reference. Per emulator:

- mGBA and BizHawk (whose GBA core is mGBA): scan the process memory map for a read-write region exactly 0x48000 bytes long (256 KiB EWRAM followed by 32 KiB IWRAM). EWRAM is the region start, IWRAM is start + 0x40000. Comment says "Latest version tested: 0.10.2".
- VBA and VBA-M: byte-signature scan of the executable, such as `48 8B 05 ?? ?? ?? ?? 81 E3 FF FF 03 00` (an EWRAM mask), to find static pointers. Separate 32-bit and 64-bit signatures, plus an older fallback. Tested up to VBA-M 2.1.7.
- RetroArch: finds the loaded core by DLL name (`mgba_libretro.dll`, `gpsp_libretro.dll`, `vbam_libretro.dll`, ...) and applies a per-core scan. Only Windows module names are listed.

### Breakage

The size-scan approach for mGBA has survived from 2023 to 2025 with only a macOS process name added in Aug 2025. Signature scans are tied to compiler output, so each VBA-M or core rebuild can break them; `asr` already carries multiple signature variants per emulator. We found no data on breakage frequency beyond this commit history.

### OS blockers

- **Linux:** `process_vm_readv` needs a `PTRACE_MODE_ATTACH_REALCREDS` check, so Yama applies. At `ptrace_scope=1` (the default on Arch, and on this machine) only descendants can be read, which works if our app launches the emulator. Level 2 needs `CAP_SYS_PTRACE`; level 3 blocks it entirely. Flatpak or Snap sandboxes likely block it too (**unverified**).
- **macOS:** `task_for_pid` needs root or the `com.apple.security.cs.debugger` entitlement, which prompts for admin credentials and lasts 10 hours. Apple says even a debugger "can't get the task ports of processes that don't have the get-task-allow entitlement" when they are SIP-protected. Notarized, hardened-runtime emulator builds lack `get-task-allow`, so expect failure without root (**unverified** per emulator build).
- **Windows:** `ReadProcessMemory` on a same-user process works without admin. Antivirus heuristics may flag a process that opens other processes for reading (**unverified**, no primary source).

## Recommendation

1. **RetroArch adapter first among bridgeless options.** It needs no script, the launcher can enable it with `--appendconfig`, it covers GB, GBC, and GBA through four cores, and it works on every OS. Parse `GET_STATUS` crc32 but do not depend on it, since master dropped it; fall back to reading the header where the core maps ROM.
2. **mGBA adapter via a Lua bridge.** mGBA 0.10 has the needed socket and memory APIs and gives game code and CRC32 directly. Users of 0.10.x must load the script by hand once per session; `--script` will remove that step when 0.11 ships.
3. **BizHawk adapter via a Lua bridge** launched with `--lua`. Model the protocol on Archipelago's connector (our script as a TCP server with batched, domain-named reads), which avoids `comm.socketServer`'s length-prefix quirks and fixed client role.
4. **SkyEmu adapter is cheap to add** because it is plain HTTP with no bridge, but its user base is small. Treat it as optional.
5. **Do not build on raw process memory.** It is OS-specific, blocked by default on macOS, depends on launch parentage on Linux, and needs per-version signatures for everything except mGBA. Keep it as a possible fallback only.
6. Skip NanoBoyAdvance, standalone SameBoy, and standalone Gambatte: they expose no API. Users of SameBoy or Gambatte can use them through RetroArch.

Design note for the adapter interface: addressing differs (bus addresses for RetroArch, mGBA `emu`, SkyEmu, GDB; domain offsets for BizHawk and mGBA domains), so the adapter should accept a domain plus offset and translate per emulator.

## Sources

- mGBA scripting docs: https://mgba.io/docs/scripting.html
- mGBA changelog: https://github.com/mgba-emu/mgba/blob/master/CHANGES
- mGBA `--script` option (master): https://github.com/mgba-emu/mgba/blob/master/src/platform/qt/ConfigController.cpp
- mGBA GDB stub: https://github.com/mgba-emu/mgba/blob/master/src/debugger/gdb-stub.c
- mGBA libretro memory map: https://github.com/mgba-emu/mgba/blob/master/src/platform/libretro/libretro.c
- RetroArch network control docs: https://docs.libretro.com/development/retroarch/network-control-interface/
- RetroArch 1.22.2 `command.c`: https://github.com/libretro/RetroArch/blob/v1.22.2/command.c
- RetroArch master `command.c`: https://github.com/libretro/RetroArch/blob/master/command.c
- RetroArch default port: https://github.com/libretro/RetroArch/blob/master/config.def.h
- RetroArch CLI (`--appendconfig`): https://github.com/libretro/RetroArch/blob/v1.22.2/retroarch.c
- RetroArch command polling: https://github.com/libretro/RetroArch/blob/v1.22.2/input/input_driver.c
- gpSP memory map: https://github.com/libretro/gpsp/blob/master/libretro/libretro.c
- Gambatte memory map: https://github.com/libretro/gambatte-libretro/blob/master/libgambatte/libretro/libretro.cpp
- SameBoy libretro memory map: https://github.com/libretro/SameBoy/blob/buildbot/libretro/libretro.c
- BizHawk CLI: https://github.com/TASEmulators/BizHawk/blob/master/src/BizHawk.Client.Common/ArgParser.cs
- BizHawk comm library: https://github.com/TASEmulators/BizHawk/blob/master/src/BizHawk.Client.Common/lua/CommonLibs/CommLuaLibrary.cs
- BizHawk gameinfo library: https://github.com/TASEmulators/BizHawk/blob/master/src/BizHawk.Client.Common/lua/CommonLibs/GameInfoLuaLibrary.cs
- BizHawk GBA domains: https://github.com/TASEmulators/BizHawk/blob/master/src/BizHawk.Emulation.Cores/Consoles/Nintendo/GBA/MGBAHawk.IMemoryDomains.cs
- BizHawk GB domains: https://github.com/TASEmulators/BizHawk/blob/master/src/BizHawk.Emulation.Cores/Consoles/Nintendo/Gameboy/Gambatte.IMemoryDomains.cs
- BizHawk platforms: https://github.com/TASEmulators/BizHawk/blob/master/README.md
- SkyEmu HTTP server: https://github.com/skylersaleh/SkyEmu/blob/dev/docs/HTTP_CONTROL_SERVER.md
- VBA-M source tree: https://github.com/visualboyadvance-m/visualboyadvance-m
- NanoBoyAdvance: https://github.com/nba-emu/NanoBoyAdvance
- SameBoy: https://github.com/LIJI32/SameBoy
- Ironmon-Tracker: https://github.com/besteon/Ironmon-Tracker
- pokebot-gen3: https://github.com/40Cakes/pokebot-gen3 (see `requirements.py`)
- Archipelago BizHawk connector: https://github.com/ArchipelagoMW/Archipelago/blob/main/data/lua/connector_bizhawk_generic.lua
- LiveSplit asr GBA scanners: https://github.com/LiveSplit/asr/tree/master/src/emulator/gba
- PokeFinder: https://github.com/Admiral-Fish/PokeFinder
- Yama: https://docs.kernel.org/admin-guide/LSM/Yama.html
- `process_vm_readv(2)`: https://man7.org/linux/man-pages/man2/process_vm_readv.2.html
- Apple debugger entitlement: https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.debugger
- Apple hardened runtime: https://developer.apple.com/documentation/security/hardened-runtime
