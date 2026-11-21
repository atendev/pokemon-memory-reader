# `/settings` and `/about` routes: decision report

Ticket: [`/settings` and `/about` routes](../tickets/075-settings-and-about-routes.md) (task). Spec §9.5 and [amendment 021](./021-viewer-control-routes.md).

## Run

- The parent wayfinder-master session ran the Jev audit, so this child skipped it.
- This is a pickup of an earlier thread's handoff at `a6c2d07`. That thread wrote the routes. This one wrote the tests, the compile smoke and the CI change, and ran the audit.
- The Gemini and GPT seats were out of quota, so the council ran with the Claude seat only, a haiku auditor. It returned APPROVE 8 in round 1 and APPROVE 8 in round 2. The other two seats count as `n/a`.
- The master's overrides replaced the commit gate and CI. This report is committed with the work, and the branch never merges.
- Local checks: `bun run lint` and `bun run typecheck` pass. `bun test` has 1001 passing and one failing. The failing test is `the Lua core runs under Lua 5.3 or 5.4`, which pins 5.3 and 5.4 and sees the machine's Lua 5.5.1. This diff touches no bridge or bridge test file. The compiled executable passes `scripts/smoke.ts`, including the new `/about` and notices checks.

## Decisions

| # | Question | Options | Choice | Made by | Audit |
|---|---|---|---|---|---|
| 1 | Does `PUT /settings` clamp an out-of-range `pollHz`? | Clamp like a hand edit; refuse | Refuse with `invalid_setting`, so the viewer never saves a value other than the one typed | Implementer | Accepted |
| 2 | What does an empty patch do? | Rewrite the file; write nothing | Write nothing and answer with the current settings | Implementer | Accepted |
| 3 | What does `/about` return beyond amendment 021 item 9? | Only `version`, `target`, `commit`, `versionLine`; add `lgpl` and `notices: boolean` | Add both. About needs the LGPL lines, and the viewer needs to know whether notices ship | Implementer | Accepted |
| 4 | Which code does a raw-read timeout map to? | `not_connected`; `bad_read` | `not_connected`, since the emulator didn't answer | Implementer | Accepted |
| 5 | Does `POST /settings/icon-cache/clear` belong here? | Build it; surface a ticket | Surface a ticket blocked by the icons route ticket, since it needs the cache that ticket builds | Implementer | Accepted |
| 6 | Where do the guards and route table live? | Per-ticket; shared here | Shared, here, because the adapters, manual-picks, update and icons tickets reuse them. `internalRoute` looks the guard up in `ROUTES` and throws for a route not in the table | Implementer | Accepted |
| 7 | How are notices embedded without breaking a dev build? | Static import; dynamic text import in try/catch | Dynamic import in try/catch. A build without `THIRD-PARTY-NOTICES.txt` still compiles (checked), serves a 404 and reports `notices: false` | Implementer | Accepted |
| 8 | Does the nested `adapters` patch reject unknown keys? | Strip them; refuse | Refuse. A test showed `{ adapters: { mgba: { nope: 1 } } }` was accepted and stripped, so the endpoint schema is now strict | Implementer, found by a new test | Accepted |
| 9 | Which compile jobs run `bun run notices`? | Only compile smoke; also rehost smoke | Both, since both run `scripts/smoke.ts`, which now fails when notices are missing | Implementer | Accepted |
| 10 | What does the smoke check about LGPL? | Any non-empty list; both named components | Both `JavaScriptCore` and `tinycc` with a copyright line, run against the real executable | Council seat (round 1, minor) | Fixed, re-approved in round 2 |

## Declined minor problems

- CORS narrowed from `*` to `/api/v2/*`, which drops the header from `/bridges/:file`. Declined. Amendment 021 item 3 says no internal route sends `Access-Control-Allow-Origin`, and the bridge file is static, fetched same-origin or by emulators.
- The Lua test failure was asserted without output. Answered with the test output (`Received: "version Lua 5.5"`) and the empty diff on bridge files. Not a code change.

## Surfaced

- `POST /settings/icon-cache/clear`, a task blocked by the icons route and cache ticket. Its row is in `ROUTES` as a write route once built.
