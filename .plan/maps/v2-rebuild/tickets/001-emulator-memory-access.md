---
type: research
blocked_by: []
assets: [../assets/001-emulator-memory-access.md]
---

# Emulator memory access APIs

## Question

For each candidate emulator, how can an outside program read emulated memory, and what does the user have to do to enable it?

Cover mGBA (standalone, 0.10 and later), RetroArch (network commands with the mGBA, gpSP, Gambatte, and SameBoy cores), and BizHawk (`--lua`, `comm.socket*`, external tools). Also cover any other GB, GBC, or GBA emulator with a usable API, such as SkyEmu, NanoBoyAdvance, VBA-M, or standalone SameBoy and Gambatte.

For each one, find:

- The access method, and whether it needs a bridge.
- Whether a bridge can be loaded automatically, for example with a command-line flag when the app launches the emulator.
- Which memory domains are readable (WRAM, EWRAM, IWRAM, ROM, SRAM), and how addresses are expressed.
- Read granularity and expected latency, such as maximum bytes per request.
- How to get the ROM hash, game code, or header.
- Platform support on Windows, Linux, and macOS.

Separately, assess raw process memory reading (`ReadProcessMemory`, `process_vm_readv`, macOS `task_for_pid`). How do existing tools find emulated RAM inside the emulator process? How often do emulator updates break them? What blocks it on each OS (permissions, ptrace scope, antivirus, macOS hardened runtime)?

## Answer

RetroArch 1.22.2 needs no bridge. `READ_CORE_MEMORY` over UDP port 55355 reads system bus addresses from the core's libretro memory map, and the mGBA, gpSP, Gambatte, and SameBoy cores all publish one. The launcher can enable it with `--appendconfig`. gpSP maps only IWRAM and EWRAM, so it has no ROM header, and master has dropped the crc32 that `GET_STATUS` returns in 1.22.2. mGBA 0.10.x needs a Lua bridge built on its `socket` API, and the user must load it by hand. Its `--script` flag exists only on master, ahead of 0.11. In exchange it gives `getGameCode()` and a CRC32 directly. BizHawk needs a Lua bridge, but `--lua` loads it at launch. Archipelago's LuaSocket TCP connector is proven prior art, and BizHawk does not run on macOS. SkyEmu has a bridgeless HTTP `/read_byte` API, while NanoBoyAdvance, standalone SameBoy, and standalone Gambatte have no usable API. Raw process memory works on mGBA through a stable 0x48000-byte region scan, but other emulators need per-build signatures, macOS blocks it without root or a debugger entitlement, and Linux Yama limits it to child processes. For the adapter choice, build RetroArch first, then mGBA and BizHawk Lua bridges. Address requests by domain plus offset and translate them in each adapter, and leave process memory out. Details, tables, and sources are in [the asset file](../assets/001-emulator-memory-access.md).
