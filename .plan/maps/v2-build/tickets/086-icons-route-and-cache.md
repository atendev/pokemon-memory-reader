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

## Handoff

Branch `t3/icons-route-cache`, based on `wayfinder/v2-build-master` at ca1fde5. Audit round: 0 (no council run yet). Timing phases marked: implement.

Done, in `server/src/icons/` (`source`, `keys`, `maps`, `png`, `plan`, `service`): key grammar, lookup plan (pack, cache, upstream; hack-first), cache with temp+rename, 404 memory, 60 s backoff, 4 parallel fetches, shared in-flight fetch, prune and clear. `GET /icons/*` is in `route-table.ts` (static), `app.ts`, `server.ts` and `main.ts` (prune at startup, settings read live). Tests: `server/test/icons/{keys,plan,service}.test.ts` and icon cases in `server/test/api/internal-routes.test.ts`. Typecheck and those tests pass; Biome was run on `server/`.

Left, in order:
1. Run `bunx biome check .` (the root run was not seen) and the whole `bun test`. Known unrelated failure: Lua 5.5 check in `server/test/bridge/core.test.ts`.
2. Add `docs/icon-packs.md` (pack layout from spec §11.9) and link it from the ticket report.
3. Run `council-audit` (Claude seat only, others `n/a`), up to five rounds.
4. Write `assets/086-icons-route-and-cache-report.md`, run unslop, run the Timing close, write `## Answer` into the ticket, delete this section, commit, push, open PR against `wayfinder/v2-build-master`, return DONE.

Decisions to put in the report: `mystery` is the route key and `unknown` the pack file name for the ??? type. Fairy is unmapped (no Gen 3 icon). Any 4xx except 429 is a remembered miss, 429 and 5xx back off 60 s (jsDelivr answers 403 for some missing files). Gen 1 and Gen 2 species have no dex map until their reference data ships, so they 404. `ITEM_SLUGS` ships empty, so every item request 404s.

Surface: ticket "Icon item ID tables and `check-icon-map`" (task, blocked by 086): fill `ITEM_SLUGS` per art version from PokeAPI `item_game_indices`, add the `check-icon-map` HEAD script. Also Gen 1-2 species dex tables.

Read first: this ticket, `server/src/icons/service.ts`, `plan.ts`.
