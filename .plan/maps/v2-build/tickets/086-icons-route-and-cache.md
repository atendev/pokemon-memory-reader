---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795260524
claimed_at: 2026-11-21T12:05:00Z
---

# `/icons` route and cache

## What to build

Spec §11.9, server side. The `/icons` route, its cache, and the icon pack lookup order. Icons are not committed from game ROMs or copyrighted sets, so the built-in fallback is whatever the spec names. Read the section first, and if it needs a decision it doesn't make, stop and open a grilling ticket instead of choosing.

## Acceptance criteria

- Tests cover a cache hit and miss, a missing icon, a bad path and the pack lookup order.
- No ROM bytes or third-party icon files are committed.
- The route follows the route-table test.

## Answer

`GET /icons/*` is built in `server/src/icons/` (key grammar, lookup plan, cache, upstream fetch) and wired through the static route table, `app.ts`, `server.ts` and `main.ts`. Lookup runs pack, cache, then upstream in `online` mode, hack folder first for hack profiles. The pack layout is in `docs/icon-packs.md`. Decisions: `mystery` is the ??? route key (`unknown` in the pack); Fairy is unmapped; any `4xx` except `429` is a remembered miss while `429` and `5xx` back the source off for 60 s; Gen 1-2 species answer `404` until their reference data ships; `ITEM_SLUGS` ships empty, so official-profile items answer `404`. Report: [086 report](../assets/086-icons-route-and-cache-report.md). Audit: Claude seat APPROVE at round 1 (8), other seats `n/a`.

Timing: wall 21m, active 9m, user 0s, wait 3m, blocked 8m | setup 11m, implement 6m, audit 2m (1 round) | tools 64 (4 subagent) | limits 1 (5-hour limit), compactions 0, handoffs 1 | ctx peak 149k | cost $2.35 sonnet-5-5 + $0.02 haiku-5-5
