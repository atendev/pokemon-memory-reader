---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T15:00:00Z
---

# Add a fallback or retry for jsDelivr 403s in the icon sources

## What to build

Surfaced by [Icon item ID tables and `check-icon-map`](./105-icon-item-tables-and-check-icon-map.md). `check-icon-map` finds two Gen 3 sprites that jsDelivr answers with 403, `firered-leafgreen/shiny/212.png` and `icons/149.png`. Both exist on raw GitHub and `@master` fails the same way, so a newer pin doesn't help. Add a fallback source or a retry for jsDelivr 403s in the `/icons` upstream, following the 429 and 5xx backoff rules from [the icons ticket](./086-icons-route-and-cache.md), and make `check-icon-map` use it.

## Acceptance criteria

- A jsDelivr 403 falls back to the second source before the miss is remembered.
- `check-icon-map` passes for the two known paths, or lists them as known blocked with the reason.
- The fallback never makes a request when `icons.mode` has no provider.
