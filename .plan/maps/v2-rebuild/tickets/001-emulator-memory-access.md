---
type: research
blocked_by: []
assets: []
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
