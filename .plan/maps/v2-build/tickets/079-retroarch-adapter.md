---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795256075
claimed_at: 2026-11-21T10:45:51Z
---

# RetroArch adapter

## What to build

Spec §3.4, [the 026 amendment](../assets/026-retroarch-probe-and-batch-caps.md) and [the 014 amendment](../assets/014-rom-keying-and-reidentification.md). Network commands over UDP. Probe with `GET_STATUS`, wait 1 s, and count any valid reply as usable. Reads are cut at descriptor boundaries and 16 KiB, sent all at once and all-or-nothing, with one datagram per range. RetroArch is disconnected after 30 s with no reply (spec §8.6), and only RetroArch re-checks the identified game, every 2 s, using its content name when it has no hash. Bridge caps are checked at profile load and never split at run time.

Test it against a TypeScript fake RetroArch UDP server, in the style of the fake bridge. A real RetroArch smoke test is a later HITL ticket and isn't part of this one.

## Acceptance criteria

- The adapter implements the interface from [interfaces 004](../assets/004-core-module-interfaces.md) with probe, hold and live modes.
- Tests cover the 1 s probe, descriptor-boundary cuts, an all-or-nothing batch with one lost datagram, the 30 s disconnect, and the 2 s re-check seeing a changed game.
- The party resource works end to end through the fake RetroArch on synthetic Emerald memory.

## Resolution

The RetroArch adapter is built in `server/src/adapter/retroarch/` (`adapter.ts` and the pure `protocol.ts`) on branch `t3/retroarch-adapter`. It implements `ManagedAdapter` with probe, hold and live modes, and `GameInfo` gained an optional `contentName`. Tests against a TypeScript fake RetroArch UDP server cover the 1 s probe, descriptor-boundary and 16 KiB cuts, the all-or-nothing batch with one lost datagram, the 30 s disconnect, the 2 s re-check seeing a changed game, and the party resource on synthetic Emerald memory. 38 tests pass in `server/test/retroarch`. The one failing test in the server suite is the known host Lua 5.5 check. The decision report is [079-retroarch-adapter-report.md](../assets/079-retroarch-adapter-report.md). Council audit: Claude seat approved in round 2 with score 8. Gemini and GPT seats skipped (out of quota).

Timing: wall 8m, active 8m, user 0s, wait 0s, blocked 0s | implement 5m, audit 2m (1 round), fix 39s | tools 46 (6 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 146k | cost $1.86 sonnet-5-5 + $0.02 haiku-5-5
