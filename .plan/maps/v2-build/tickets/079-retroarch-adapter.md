---
type: task
blocked_by: []
---

# RetroArch adapter

## What to build

Spec §3.4, [the 026 amendment](../assets/026-retroarch-probe-and-batch-caps.md) and [the 014 amendment](../assets/014-rom-keying-and-reidentification.md). Network commands over UDP. Probe with `GET_STATUS`, wait 1 s, and count any valid reply as usable. Reads are cut at descriptor boundaries and 16 KiB, sent all at once and all-or-nothing, with one datagram per range. RetroArch is disconnected after 30 s with no reply (spec §8.6), and only RetroArch re-checks the identified game, every 2 s, using its content name when it has no hash. Bridge caps are checked at profile load and never split at run time.

Test it against a TypeScript fake RetroArch UDP server, in the style of the fake bridge. A real RetroArch smoke test is a later HITL ticket and isn't part of this one.

## Acceptance criteria

- The adapter implements the interface from [interfaces 004](../assets/004-core-module-interfaces.md) with probe, hold and live modes.
- Tests cover the 1 s probe, descriptor-boundary cuts, an all-or-nothing batch with one lost datagram, the 30 s disconnect, and the 2 s re-check seeing a changed game.
- The party resource works end to end through the fake RetroArch on synthetic Emerald memory.
