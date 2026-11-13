# Decision report: Icon loading and fallbacks (ticket 021)

Grilling ticket, resolved 2026-11-12 in five interview rounds with the owner. The resolution is the `## Answer` in [021-icon-loading.md](../tickets/021-icon-loading.md). The owner made every decision in the table below by picking from the options shown, and the main thread wrote the options and the recommendations. Every pick matched the recommendation.

Audit verdict for the written resolution: APPROVE in round 3. Rounds 1 and 2 raised problems. The owner approved a third round past the runner's two-round limit.

## Grilling decisions

| # | Question | Options | Choice |
|---|---|---|---|
| Q1 | How does the viewer get icons? | Program proxy with disk cache; browser hotlinks directly; proxy without disk cache | Program proxy with a disk cache in the data folder |
| Q2 | Default upstream URL | jsDelivr at a pinned SHA; jsDelivr `@master`; raw GitHub `@master` | jsDelivr at a pinned SHA |
| Q3 | Which Pokémon images | Game-matched front sprites on cards plus Gen 3 menu icons on Boxes and opponent tiles; modern sprites everywhere; Gen 3 menu icons everywhere | Game-matched sprites |
| Q4 | Fallback when a Pokémon has no image | Type-coloured tile; plain grey tile; nothing | Type-coloured tile with the name's first letter or `#<id>` |
| Q5 | How game IDs become icon files | Program maps logical keys with checked-in tables; API exposes icon keys; viewer slugifies names | Program maps logical keys |
| Q6 | How users supply their own icons | Local pack folder plus mirror URL; local folder only; URL template only | Local folder plus mirror URL |
| Q7 | Upstream art for hack species | Vanilla Gen 3 range only; any non-null dex; user pack only | Vanilla range only |
| Q8 | Disk cache policy | Keep forever and prune unused sources; size-capped LRU; TTL expiry | Keep forever, prune unused sources at startup, plus a Clear button |
| Q9 | Shape of the `icons` config key | `{ mode, baseUrl }`; `{ enabled, baseUrl }`; per-category toggles | `{ "mode": "online", "baseUrl": null }` with modes `online`, `local` and `off` |
| Q10 | Route failure and trust rules | Strict and fail fast; lenient pass-through; strict and loopback-only | Strict and fail fast |
| Q11 | Back or animated sprites | Static front sprites; back sprite for the player's battler; animated where available | Static front sprites |
| Q12 | Game to art folder mapping | Listed mapping in an `artVersion` profile field with FRLG type icons for Gen 1-2; same with Gen 1-2 type text; derive from game code | `artVersion` profile field, Gen 1-2 use FRLG type icons |
| Q13 | How URLs name the art version | Profile ID in the URL; `artVersion` added to `status`; route uses the current game | Profile ID in the URL |
| Q14 | Is `/icons` public | Viewer-only but usable; public in the API package; viewer-only and hidden | Viewer-only, usable at the overlay author's own risk |
| Q15 | Settings icon section | Full section; mode and URL only; mode only | Full section, including cache size, Clear button and the art notice |
| Q16 | Upstream coverage check | Dev script plus a release step; networked CI job; no check | `check-icon-map` dev script, run by `RELEASING.md` when the SHA changes |
| Q17 | HTTP caching (revised Q10) | ETag plus `no-cache`; long cache with a revision param; short max-age | ETag plus `no-cache` |

Q17 reopened part of Q10. Q13 kept URLs stable across game changes, but a pack edit, a mode change or a mirror change can still change what one URL serves, and nothing watches the pack folder. A long `Cache-Control` would have left OBS showing stale art, so the owner switched to revalidation.

## Decisions the main thread made while writing the resolution

These follow from the owner's answers. None was put to the owner separately.

| Question | Choice | Reason |
|---|---|---|
| Route key for Pokémon | Internal species ID, not dex | The API always sends `species.id`, and `dex` is null for hack species. Q7's vanilla range is defined by internal ID. The program maps ID to dex. |
| Pack layout for items | `item/{itemSlug}.png`, plus `hack/{profileId}/item/{itemId}.png` | Slugs are readable for pack authors and match PokeAPI file names. Hack-only items have no slug. |
| Hack items | The same vanilla-set rule as species, using the checked-in item table for the hack's `artVersion` | Q7 covered species only. CFRU adds items above the vanilla IDs, which hit the same wrong-art problem. |
| Gen 1 items | Mapping tables cover Gen 1-3, with dev-time name matching where PokeAPI lacks a generation's index | The Gen 1 bag has items. The auditor flagged that the first draft left Gen 1 out. |
| Gen 1-2 sprite folder | `transparent/` where present, `transparent/shiny/` for Gen 2 shiny, base folder for `red-green-japan` | Checked against the upstream tree. Transparent sprites suit the dark theme. |
| Shiny on menu icons | Normal icon | Gen 3 menu icons have no shiny set. |
| First pinned SHA | `1b3b7c0a538dd2226ae08d0d2f8955125075bbd4` (2026-11-03), the latest upstream commit when the ticket was written | A concrete starting pin. `check-icon-map` must pass before release. |
| Cache source ID | `pokeapi-<sha>` or `mirror-<12 hex of sha256(baseUrl)>`. The source in use follows `baseUrl` whatever the mode. Clear deletes every source. | Makes "prune unused sources" from Q8 implementable. |
| Invalid files | An invalid pack file is treated as absent, an invalid cached file is refetched, and an invalid upstream file returns 404 and is not cached | Q10 set the PNG and size checks but not what happens after a failure. |
| Clear-cache route | `POST /settings/icon-cache/clear` with the `PUT /settings` guards | A write from the viewer, so it gets the same protection as other settings writes. |
| Glossary | Added Icon pack and Art version to `CONTEXT.md` | Both are new domain terms used across tickets. |

## Audit

The haiku auditor reviewed the first draft and raised 14 problems, all gaps or unclear wording, not disagreements with the owner's choices:

1. The reason given for rejecting raw GitHub didn't hold at a pinned SHA. The rejection now cites CDN status, the 5-minute cache and throttling.
2. The key grammar wasn't defined. A Key grammar bullet now defines it.
3. Gen 1 items weren't covered. The tables now cover Gen 1-3.
4. The vanilla item set had no source. It now comes from the item table of the official profile that shares the hack's `artVersion`.
5. The lookup order for in-range hack species was missing. A Lookup order bullet now states it.
6. What a failed PNG check does wasn't stated. Route rules now cover pack, cache and upstream failures.
7. "Source in use" and the scope of Clear were undefined. Both are now stated.
8. Gen 2 shiny paths and shiny menu icons were missing. Both are now stated.
9. The opponent's battler had no sprite rule. Both battlers now use front sprites.
10. The Gen 1-2 box icon fallback wasn't stated as such. A bullet now states it.
11. An Excluded entry contradicted `local` mode. It was reworded.
12. Which fallback applies to which icon kind was unclear. Each kind's fallback is now stated.
13. Nothing said what happens if the first pin fails. The resolution now says to fix the tables or pin a newer SHA, and the release is blocked until the check passes.
14. The Art version glossary entry claimed more than cards use. It was narrowed to card sprites.

Re-check result: 11 of the 14 resolved, and three remained open. Each was fixed, and the auditor approved the fixes in round 3.

1. The pack path for the ??? type would be `???.png`, which is illegal on Windows. Pack paths now write it as `unknown`, PokeAPI's name for type `10001`.
2. "The official profile that shares the hack's `artVersion`" assumed exactly one such profile, and assumed it was loaded. Item tables are now keyed by `artVersion` and checked into `server/`, so no profile has to be loaded.
3. "Gen 1 shows the normal sprite for shiny" contradicted the lookup rules, which would return 404. Gen 1 has no shiny flag, so the viewer never requests a Gen 1 shiny sprite, and the route returns 404 if one is requested.

## For the master

- Decisions line: see the runner report.
- Amendments to other tickets are listed at the end of the ticket's Answer: 005 (`artVersion`), 008 (fallback tile, Settings icon section), 019 (`icons` shape, data folder entries, `GET /settings` fields, clear route) and 017 (`RELEASING.md` step). This child left those ticket files and `map.md` untouched.
- No new tickets surfaced.
- The repo has no CI workflows, and `wayfinder/v2-rebuild-master` is not on the remote, so no PR was opened.
