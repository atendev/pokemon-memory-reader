# Decision report: Viewer shell and connection screen

Ticket: [081](../tickets/081-viewer-shell.md). Task ticket, run as a child of wayfinder-master on 2026-11-21 (UTC). It builds spec §11.1 and §11.2 plus the hash routes from [amendment 021](./021-viewer-control-routes.md). No grilling or research ran.

## What changed

- `viewer/src/routes.ts`: the five screens and `About`, `hrefFor` and `routeFromHash`. An empty hash or `#/` opens Party. A hash query and a trailing slash are ignored, so `#/battle?showUnrevealed=1` is Battle. Any other path is `not_found`.
- `viewer/src/collapse.ts`: reads and writes the sidebar state under `pmr.sidebarCollapsed` in `localStorage`. A missing, unknown or throwing store leaves the sidebar expanded. `toggleCollapsed` flips the state and saves it, and `useSidebarCollapsed` calls it.
- `viewer/src/Sidebar.tsx` and `Icon.tsx`: a collapsible left sidebar with the five screens, an About link and the status block at the foot, and a toggle. Collapsed, it is a 72 px icon rail whose links keep their names through `aria-label` and `title`. A red dot shows on Battle when `battleLive` is true.
- `viewer/src/ConnectionScreen.tsx` (renamed from `EmptyState.tsx`): reflects `disconnected`, `no_game`, `unidentified` and `unsupported`. `disconnected` keeps the mGBA download and steps. An adapter problem (`unknown_bridge`, `protocol_mismatch`, `busy`, `bridge_error`) gets its own title and a reload instruction. An unidentified expansion ROM names its version.
- `viewer/src/App.tsx`: routes the hash to a screen and polls the party only on the Party route while a game is identified. `Placeholder.tsx` stands in for Battle, Boxes and Trainer & bag.
- `viewer/src/styles.css`: the top bar and page styles give way to the shell layout. The same plain CSS is kept, on the 8 px grid, with 44 px targets. Under 720 px the sidebar is always a rail. Party is 2 columns with the sidebar expanded and 3 with it collapsed at 1100 px and wider.
- Tests: `routes.test.ts`, `collapse.test.tsx` and `shell.test.tsx` are new, and `render.test.tsx` passes a route to `Screen`.

## Evidence

- `bun test viewer`: 51 pass, 0 fail.
- `bun run typecheck` and `bun run lint`: clean.
- `bun run build:exe` then `bun scripts/smoke.ts`: "smoke passed". The smoke loads every script and stylesheet the served page names.
- The running executable served a chunk that contains "Collapse sidebar", and `/api/v2/status` answered `disconnected`.
- No headless browser is on this machine. No test runs the bundle in a browser, and nothing clicked the toggle. The tests render `<App />` on the server with a stubbed `localStorage`, and test the toggle function on its own.

## Decisions

| # | Question | Options | Choice | Made by | Audit |
| --- | --- | --- | --- | --- | --- |
| 1 | The ticket lists `unsupported` as a state. `status.state` has no such value. Where does it come from? | Add a state; or read the 503 `unsupported` code from a resource | Read it from the Party resource. The spec makes it a 503 code (§7.2) and `state` stays `game` | Implementer | Approved in round 2 |
| 2 | Do Settings and About show without a game? | Hide them like the game screens; or always show them | Always show them. Settings holds the adapter pin and ports a user needs to fix a disconnect | Implementer | Approved in round 2 |
| 3 | When does the party poll? | Whenever a game is identified; or only on the Party route | Only on the Party route, so the other screens hold no demand for it | Implementer | Approved in round 2 |
| 4 | How is the sidebar state restored? | `localStorage`; or the hash | `localStorage`, as spec §11.4 does for its setting. The hash would collide with routes | Implementer | Approved in round 2 |
| 5 | What does an unknown hash show? | Fall back to Party; or a "Page not found" screen | A "Page not found" screen, so a typo is visible | Implementer | Approved in round 2 |
| 6 | How do five screens get icons? | An icon library; or inline SVG | Inline SVG paths in `Icon.tsx`, with no new dependency, which keeps the notices check unchanged | Implementer | Approved in round 2 |
| 7 | Where does About go? | Inside Settings; or a link in the sidebar foot | A foot link to `#/about`, which keeps the tracer's page. The Settings ticket may move it | Implementer | Approved in round 2 |
| 8 | Which §11.1 and §11.2 items wait on routes that don't exist? | Build against guessed shapes; or leave them and surface tickets | Left out: the adapter list, the data-folder path and copy button, the older or newer protocol text, the update banner, the identification notes and the missing-field notes. Surfaced as tickets | Implementer | Approved in round 2 |

## Audit

Claude seat only. The user said the Gemini and GPT seats are out of quota. Gemini and GPT seats skipped (out of quota).

- Round 1: `claude 7`, DISAPPROVE. Two blocking problems. The collapse and restore wiring had no test, and "the shell loads in the compiled executable" rested on a string search of the bundle. Fixed the first with `toggleCollapsed`, an `<App />` render test with a stubbed store and a move of the state write out of the `setState` updater. Rebutted the second in part, as the limit above states.
- Round 2: `claude 8`, APPROVE. No blocking problems.

Declined or rebutted minor problems, all from the claude seat:

- The `unsupported` path is tested with a synthetic party prop. Rebutted. `PmrApiError.code` is the 503 body's `error.code` (`api/src/client.ts:37`), and `useResource.ts` passes it to the screen.
- The Battle dot is never set. Declined. No battle data exists yet, so [the Battle screen ticket](../tickets/082-viewer-battle-screen.md) wires it. The prop and its test are in place.
- Under 720 px the toggle and the labels are hidden. Declined. The rail is the intended small-screen form, and every link and the status dot keep an `aria-label`.
- The disconnected, `no_game` and null cases appear in both `render.test.tsx` and `shell.test.tsx`. Declined. One tests `Screen` and the other tests `ConnectionScreen`.
- The toggle's click wiring has no test of its own. Declined. It is one line over a tested function, and the viewer has no DOM test setup.
- No test runs the bundle in a browser. Declined, and disclosed above.

## Left for other tickets

- The connection screen's data-folder path with a copy button, the adapter list and the older or newer protocol text need `GET /settings` paths ([075](../tickets/075-settings-and-about-routes.md)) and `/adapters` ([080](../tickets/080-adapter-selector-and-adapters-route.md)), and a way for the viewer to learn the program's protocol number.
- The update banner needs the `/update` route ([076](../tickets/076-update-check-and-update-route.md)).
- The identification notes (header match, a manual pick after a signature mismatch) need [full identification](../tickets/072-full-identification.md), and the notes on fields a generation lacks need decoders that report them.
- `bun install --frozen-lockfile` was needed in the worktree to run the tests. No lockfile change.
