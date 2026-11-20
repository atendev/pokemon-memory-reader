---
type: task
blocked_by: [079, 073]
---

# Adapter selector, discovery and `/adapters`

## What to build

Spec §3.3 and [the 021 amendment](../assets/021-viewer-control-routes.md). The selector fills the slot `read-loop.ts` marks. Discovery probes the available adapters, `/adapters` lists them with probe results, and a switch applies for this run only, behind the shared write guard. A pick is never saved to config, and an adapter that stops responding is shown as a problem in `status.adapter`.

## Acceptance criteria

- Tests cover discovery with only the bridge, only RetroArch, both, and neither.
- A switch changes the live adapter, the old session's resources are dropped, and a restart returns to the configured default.
- The route-table test covers `/adapters`.
