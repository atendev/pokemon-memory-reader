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
