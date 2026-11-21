---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T14:10:00Z
---

# Apply live `adapters` endpoint changes

## What to build

[Adapter selector, discovery and `/adapters`](./080-adapter-selector-and-adapters-route.md) builds each adapter with the endpoint from startup, and `config.json` changes to `adapters.mgba` or `adapters.retroarch` only take effect on restart. Make the selector apply a changed endpoint to a live adapter, following the live and startup key rules from [data folder and config](./073-data-folder-and-config.md) and the 021 amendment. Check whether the spec lists these keys as live or startup before building, and if it lists them as startup keys, rule this ticket out instead.

## Acceptance criteria

- A changed endpoint reaches the adapter without a restart, and the old session's resources are dropped.
- An unchanged endpoint touches nothing.
- Tests cover both adapters, and `pending()` no longer lists a key that now applies live.

Timing: wall 3m, active 3m, user 0s, wait 0s, blocked 0s | implement 2m, audit 44s (1 round) | tools 27 (2 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 90k | cost $0.82 sonnet-5-5 + $0.01 haiku-5-5

## Answer

Spec §9.4 lists the adapter endpoints as live keys, so this was built, not ruled out. `Selector.refreshEndpoints()` rebuilds each attached adapter whose host or port changed, closing the old one and dropping live when it was the live adapter. `main.ts` builds adapters from `config.applied()` and calls it when the `adapters` key changes. An unchanged endpoint touches nothing. `pending()` already lists only startup keys, and `config.test.ts` asserts that for `adapters`. Four selector tests cover both adapters, a pinned rebuild and the unchanged case. The installed `mgba.lua` still carries the startup endpoint until a restart, which is surfaced as a follow-up. [Report](../assets/106-apply-live-adapter-endpoint-changes-report.md).
