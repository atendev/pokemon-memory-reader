---
type: task
blocked_by: []
---

# `/icons` route and cache

## What to build

Spec §11.9, server side. The `/icons` route, its cache, and the icon pack lookup order. Icons are not committed from game ROMs or copyrighted sets, so the built-in fallback is whatever the spec names. Read the section first, and if it needs a decision it doesn't make, stop and open a grilling ticket instead of choosing.

## Acceptance criteria

- Tests cover a cache hit and miss, a missing icon, a bad path and the pack lookup order.
- No ROM bytes or third-party icon files are committed.
- The route follows the route-table test.
