# Tracer viewer and executable: decision report

Ticket: [Tracer viewer and executable](../tickets/010-tracer-viewer-and-executable.md). Two implementer threads built this, and the second picked up a handoff. The implementer made every decision below unless noted. The audit verdict is at the end.

## What was built

- `viewer/` is a React app with one Party screen. It reads `status` and `party` through the API package's client and shows six cards with name fallbacks and no icons. With no game it shows an empty state. The CSS follows the `apple` skill's dark palette, 44 pt targets, the 8 pt grid and its type scale where the viewer design left them open.
- `api/src/client.ts` gained `get`, `getStatus`, `getParty` and `PmrApiError`.
- `server/src/main.ts` is the entry point. `cli.ts` parses flags, `data-folder.ts` resolves and creates the data folder and installs bridges, `bridges.ts` generates them, `build-info.ts` makes the `--version` line, and `log.ts` gained `consoleLog`.
- `bridges/src/build.ts` imports `core.lua` and `mgba-shim.lua` as text, so the compiled executable carries them.
- `app.ts` serves `/bridges/<name>.lua` from a map. `server.ts` takes the `viewer` and `bridges` options.
- `scripts/smoke.ts`, the `compile-smoke` job in `ci.yml` (now on, with `PMR_TARGET` and `PMR_COMMIT` defines) and a root `build:exe` script.
- Tests: client, viewer display and render, CLI parsing, data folder, the bridge route, and `main.ts` exit paths.

Checked locally: a linux-x64-baseline executable built with `bun build --compile` passes `scripts/smoke.ts` (version, status `disconnected`, viewer HTML, `mgba.lua` served and written, SIGTERM exit 0). `bun run lint` and `bun run typecheck` pass. `bun test` passes except the known Lua 5.5 version test, which expects 5.3 or 5.4 and fails on this machine only.

## Decisions

1. **Plain CSS, not Tailwind.** `bun-plugin-tailwind` under `--compile` was untested. Tailwind moves to the full viewer ticket, surfaced below.
2. **The viewer polls every 1 s.** There is no SSE yet, so a timer is the only option. It switches to SSE when that exists.
3. **Party is polled only when `status.state === "game"`.** In any other state the party GET would only return an error. `status` is always polled.
4. **The mGBA adapter sits at 127.0.0.1:7426.** Settings and selector tickets own the endpoint. The constant sits in `main.ts` with a comment.
5. **No `config.json` yet.** Flags and `PMR_DATA_DIR` are the only inputs. A flag will win over the config file when it arrives.
6. **The install steps name no data-folder path.** No route exposes it, and ticket 021 owns that. The terminal prints the path at startup.
7. **Only the `mgba` bridge is built, served and smoke-checked.** `bizhawk.lua` doesn't exist. Spec §13.3 lists both files, so the smoke script has a one-entry list that the BizHawk ticket extends. This is the one deliberate departure from the spec text.
8. **`PmrApiError.status` holds the status resource and `httpStatus` the HTTP code.** The error body carries `status`, so the field name follows the API.
9. **The executable's port-in-use and bad-flag paths exit 1 and 2.** A Windows console with a TTY waits for Enter before closing after a fatal error, per spec §9.7. Tests spawn `bun server/src/main.ts` with no TTY.
10. **Bridge lookup goes through a `Map`, never a path join.** A request can't reach the filesystem. The tests include `..%2F` cases and `constructor.lua`.
11. **The smoke script picks a free port by binding port 0 and releasing it.** A tiny race exists between release and start. CI runners start one executable at a time, so the cost is accepted over a test-only flag, which the spec forbids.
12. **The CI build defines `PMR_COMMIT` from `GITHUB_SHA::7`.** The release ticket reuses the same defines.

13. **The primary button fill is `#0066cc`, not system blue.** The auditor measured white on `#0a84ff` at 3.65:1, under the 4.5:1 floor the `apple` skill sets for 17 pt text. `#0066cc` gives 5.5:1. Decided by the implementer after the auditor's objection.
14. **The smoke script also fetches every script and stylesheet the viewer page names.** No browser is installed here, so nothing runs the React bundle. Fetching the assets proves the compiled executable embeds and serves them. A runtime error in the bundle would still pass, and the auditor accepted that gap.
15. **"No-game state" means the empty states.** A fresh run has no emulator, so `status.state` is `disconnected` and the viewer shows "Waiting for an emulator" with the bridge download link. `no_game` and `unidentified` have their own copy. The render tests are labelled to say so. Auditor raised the ambiguity, the implementer chose the reading.
16. **A failed shutdown step logs and exits 1.** Before, a throw from `server.stop()` left an unhandled rejection until the 2 s timer fired. The auditor flagged it as non-blocking and the implementer fixed it anyway.

## Surfaced

- Adopt Tailwind in the viewer (after `bun-plugin-tailwind` is shown to work under `--compile`).
- Smoke checks `bizhawk.lua` once that bridge exists.

## Audit

A haiku auditor ran two rounds. Round 1 returned two problems (button contrast, and no evidence the served viewer loads), both fixed above in decisions 13 to 15. Round 2 returned APPROVE. Its one remaining note is that nothing executes the bundle in a browser. CI is the only check of the `bun-linux-x64-baseline` target with the `--define` flags.
