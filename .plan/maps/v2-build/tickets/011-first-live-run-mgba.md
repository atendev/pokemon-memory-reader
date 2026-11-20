---
type: task
blocked_by: [010]
---

# First live run on mGBA

## Question

HITL. This ticket needs the owner's mGBA and an Emerald US 1.0 ROM. Wait until the owner says they have them.

Hand the owner a checklist:

1. Download the tracer executable artifact from CI.
2. Run it, open mGBA, and load the bridge served at `/bridges/mgba.lua`.
3. Load Emerald with a party.
4. Confirm the viewer and `/api/v2/party` match the in-game summary screens field by field.
5. Note the latency it feels like.
6. In mGBA's scripting console, print `_VERSION`, then pause the emulator and check that the API still answers. Both checks are left open by [Emulator Lua runtimes](./003-emulator-lua-runtimes.md).

Fix anything broken in the mGBA shim or adapter, with the agent working from the owner's reports. Record which values were confirmed and any shim fixes. The first fixture capture belongs to a later fixture ticket, not this one.

## Acceptance

- The owner confirms the live party matches the game.
- Shim fixes are merged with CI green.

## Answer

Done with the owner on 2026-11-20 using mGBA 0.10.5 (AppImage, run with `QT_QPA_PLATFORM=xcb`) and an Emerald US 1.0 ROM (SHA-1 matches the profile). The tracer executable was built locally, because CI never uploads an artifact for it. The bridge loaded from `bridges/mgba.lua`, `hello` and the game message arrived (`romName` POKEMON EMER, crc32 `1f1c08fb`), and `/api/v2/status` reported `state: game`, `stalled: false`, `match: header`, `signature: unchecked`. The owner checked the live party (a level 5 Torchic with a nickname) against the game's summary screens and every field matched, in the API and in the viewer. A Hidden Power of rock 33 was checked by hand against the IVs. In a battle, the viewer's HP followed the game's by about 0.9 s (frame-counted from the owner's recording), which is the viewer's 1000 ms poll (`POLL_MS`), not the read loop (20 Hz). `print(_VERSION)` printed `5.4` in mGBA, so Lua 5.4 is confirmed, and the API still answered with the emulator paused. Both checks left open by [Emulator Lua runtimes](./003-emulator-lua-runtimes.md) are closed. mGBA 0.10.5 has no scripting call that returns its version, so `emulator.version` stays null and no shim fix was needed. The Lua binding sources were not read, so a live `pairs(_G)` listing would settle that fully. Only the mGBA shim's header comment changed.
