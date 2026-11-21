---
type: task
blocked_by: [079, 073]
claimed_by: wfm-v2-build-master-1795260524
claimed_at: 2026-11-21T12:05:00Z
---

# Adapter selector, discovery and `/adapters`

## What to build

Spec §3.3 and [the 021 amendment](../assets/021-viewer-control-routes.md). The selector fills the slot `read-loop.ts` marks. Discovery probes the available adapters, `/adapters` lists them with probe results, and a switch applies for this run only, behind the shared write guard. A pick is never saved to config, and an adapter that stops responding is shown as a problem in `status.adapter`.

## Acceptance criteria

- Tests cover discovery with only the bridge, only RetroArch, both, and neither.
- A switch changes the live adapter, the old session's resources are dropped, and a restart returns to the configured default.
- The route-table test covers `/adapters`.

Timing: wall 23m, active 11m, user 0s, wait 3m, blocked 8m | implement 5m, audit 16m (3 rounds), fix 53s | tools 75 (6 subagent) | limits 1 (5-hour limit), compactions 0, handoffs 1 | ctx peak 135k | cost $2.66 sonnet-5-5 + $0.03 haiku-5-5

## Answer

The selector in `server/src/adapter/selector.ts` fills the read loop's adapter slot. It probes the mGBA bridge and RetroArch, holds a usable lower-priority adapter while a higher one settles (1.5 s), and `/adapters`, `/adapters/probe` and `/adapters/switch` serve the list, a probe-now and a switch for this run only behind the write guard. A pin closes the other adapters, a switch bumps the epoch and returns the old adapter to probing, and a fresh selector returns to the configured default. A switch passes on the adapter's `connected` state, since the bridge adapter sets it only after its strict hello check and a null game is valid. A live adapter that drops with a fault keeps that problem in `status.adapter`. A clean drop reads disconnected with no problem (spec §4.7), and silence on an open socket is `stalled`, so the ticket's "shown as a problem" is met by those signals and no new problem code. [Report](../assets/080-adapter-selector-and-adapters-route-report.md).
