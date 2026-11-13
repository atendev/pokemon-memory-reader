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
