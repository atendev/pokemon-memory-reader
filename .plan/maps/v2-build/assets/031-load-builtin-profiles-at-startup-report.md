# Load built-in profiles at server startup: decision report

Ticket: [Load built-in profiles at server startup](../tickets/031-load-builtin-profiles-at-startup.md). One implementer thread built this. The implementer made every decision below unless noted. The audit verdict is at the end.

## What was built

- `server/src/profile/startup.ts` holds the load step. It exports `loadStartupProfiles(input, log)`. That calls `loadProfiles` and returns `{ ok: false, message }` if any problem has source `builtin`. Every other problem is logged as a warning.
- `server/src/main.ts` calls it, prints the message to stderr and exits 1 on a built-in failure, and prints `Profiles: <ids>` on success.
- Tests: four unit tests in `startup.test.ts` and one subprocess test in `server/test/cli/main.test.ts`.

## Decisions

1. **The load step already existed in `main.ts`, so the ticket became a change of failure semantics.** The old code logged every problem as a warning, which let a broken build start with no profile. The ticket's acceptance names loading and failing, so both are now tested.
2. **The failure rule lives in a function outside `main.ts`.** `main.ts` runs on import, so tests can't call it. A small module gives the broken-built-in test a direct seam without a test-only flag, which the spec forbids. The function returns a result instead of throwing, so `main.ts` holds only the print and exit (auditor round 1 asked for the wiring to be testable).
3. **Only problems with source `builtin` stop startup.** User profile problems stay warnings, because user profiles are out of scope and a bad user file must never block the program.
4. **The message lists every built-in problem, each with its `builtin:<id>` path and message.** One run shows all the damage, and the message says the build is broken.
5. **The success path prints a `Profiles: <ids>` line.** The "starting the server loads `emerald-us-1.0`" test spawns the real `main.ts` and reads that line. It proves the entry point reaches the load step with the real built-ins, not just the unit.
6. **The subprocess test finds a free port by binding port 0 and releasing it.** The CLI rejects `--port 0`. The tiny race is accepted, as in ticket 010's smoke script.
7. **The broken-built-in test runs at unit level only.** `main.ts` takes no profile input, and adding an override would be a test-only hook. The unit test covers a bad `dataFormat` and a missing fixture.
8. **`user: []` stays hard-coded in `main.ts`.** Loading user profiles from the data folder is a later ticket.

## Checked locally

`bun test server` gives 236 pass and 1 fail. The failure is the Lua version test, which expects 5.3 or 5.4 and fails on this machine only because it has Lua 5.5, as in earlier reports. `bun run typecheck` and `biome ci` pass.

## Audit

Approved in round 2 by the haiku auditor. Round 1 found that the fatal path in `main.ts` had no test, and the result-type refactor in decision 2 answered it. One residual gap remains: the three-line print and exit branch has no subprocess test, because `main.ts` has no injection point.
