# Viewer icon use and icon packs: decision report

Ticket: viewer icon use and icon packs. Spec: §11.9, viewer side. Branch: `t3/viewer-icon-use-icon-packs`. Server side: [086 report](./086-icons-route-and-cache-report.md) and [docs/icon-packs.md](../../../../docs/icon-packs.md). Audit: Claude seat only. The Gemini and GPT seats are `n/a` (out of quota), so one Claude APPROVE passes the gate.

## Audit verdict

APPROVE at round 2. Claude seat 8, Gemini n/a, GPT n/a. Round 1 scored 6 with one blocking problem, fixed. Two minor problems declined in round 2, plus two fixed from round 1.

## Spec check

§11.9 decides everything this ticket needs: the URL shapes, the fallbacks, `off` mode, Gen 1 shiny, the failure rule and the pack layout. No grilling ticket is needed. One detail the spec leaves implied is how the viewer learns the icon mode, which decision 3 covers.

## Decisions

1. **Scope.** Question: which screens use icons. Choice: Party cards and both battlers use the front sprite, the Boxes grid and opponent party tiles use the menu icon, held items and types use item and type icons. The bag's item icons belong to the Trainer and bag icons ticket, and the Settings icon section belongs to the viewer settings ticket. Made by: implementer.

2. **Pack switch.** Question: what a pack switch means on the viewer side. The pack is a server folder the viewer never sees. Choice: the viewer's key is the URL, which holds the profile ID, so a profile change or a mode change gives a new key and a failed icon is tried again. A failed URL stays failed until the key changes or the page reloads (spec). Made by: implementer.

3. **Reading the mode.** Question: how the viewer knows `off`, since it must make no requests then. Options: always request and let the route answer `404`, or read `GET /settings`. Choice: read `icons.mode` from `GET /settings` every 5 s while a game is identified. A settings read stats the icon cache, so it is not polled at 1 Hz. The mode is null until the first answer and again if settings can't be read, so no icon is requested on a guess. Made by: implementer.

4. **No provider means no requests.** Choice: art with no provider above it behaves as `off`. Existing screen tests and any embedder that renders a screen alone stay request-free. Made by: implementer.

5. **Failure store.** Choice: a page-lifetime set of failed URLs, shared through `useSyncExternalStore`, with the `<img>` `onError` marking a failure. Tests set failures directly, since the suite has no DOM. Made by: implementer.

6. **Layout.** Choice: a sprite box is 64 px and a menu icon box 40 px, fixed whether the image or the tile shows, so the party card doesn't move. Eggs show a tile and ask for nothing. Made by: implementer.

7. **Fallbacks.** Choice, from the spec: a tile tinted with the primary type colour and the name's first letter or `#<id>`. An item shows its name or `#<id>`. A type keeps its existing dot and name. Made by: implementer.

8. **Gen 1 shiny.** Choice: the viewer never builds a shiny URL for generation 1, and the route would also answer `404`. Made by: implementer.

## Minor problems

- Fixed (round 1, blocking): the grey `.art-tile` background sat after the type colours at equal specificity, so tiles were always grey. The grey base rule now comes first, and a test checks the order.
- Fixed (round 1): a missing item icon changed the Item line's height. The 24 px icon now has a `-4px` vertical margin so its row keeps the text's height.
- Fixed (round 1): the active-tile regex in `BattleScreen.test.tsx` could match a later tile. It is now bound to one `<li>`.
- Declined: the tint guard test matches only `border-radius` followed by `background`. The order check beside it is the real guard.
- Declined: no test asserts the item icon's margin. The suite has no layout engine, and the fix is one CSS line.

## Evidence

- Whole `bun test`: 1277 pass, 1 fail. The failure is the known Lua version check in `server/test/bridge/core.test.ts` (host has Lua 5.5). `bun run lint` and `bun run typecheck` are clean.
- Component tests in `viewer/src/icons.test.tsx`: URL building, a found icon, a missing icon for a Pokémon, an item and a type, a pack switch (new profile retries, mode off drops images), the party card's fixed sprite box, an egg, the Boxes grid, and Battle with an unrevealed opponent making no request.
- The compiled executable test (`PMR_EXECUTABLE=out/pokemon-memory-reader`, 5 of 5 pass) serves a generated PNG from the pack at `/icons/emerald-us-1.0/pokemon/277` (200, `image/png`), answers `404` for an unpacked species, reports `icons.mode` `local` from `/settings`, and finds `/icons/` in the served viewer bundle.
- No PNG or ROM bytes are committed.
