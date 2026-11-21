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

## Answer

The default icon source now has a second base, raw GitHub at the same pinned commit. A jsDelivr 403 is asked of raw GitHub before the miss is remembered, a 404 never asks the second source, and a 429, 5xx or network error on either backs the whole source off for 60 s. A mirror has no second source, and `off` or `local` mode never reaches the fetch. `check-icon-map` uses the same fallback and passes all 5058 paths. Audit: Claude seat APPROVE at round 1 (8), Gemini and GPT not run. Report: [118 report](../assets/118-jsdelivr-403-fallback-for-icons-report.md).

Timing: wall 2m, active 2m, user 0s, wait 0s, blocked 0s | implement 1m, audit 1m (1 round) | tools 24 (2 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 86k | cost $0.72 sonnet-5-5 + $0.01 haiku-5-5
