# Regenerate the installed `mgba.lua` when the mGBA endpoint changes live: decision report

Audit: single mode, APPROVE in round 2. Claude seat scored 7 in round 1 and 8 in round 2. Gemini and GPT: skipped. Three minor problems declined, one fixed.

## What was built

- `createApp` and `startServer` take `bridges` as a record or as a function. The `/bridges/<name>.lua` route reads it on every request, so a regenerated script is served at once.
- `main.ts` keeps the generated bridges in a `let`. On a live `adapters` change it calls `generateBridges` with the current mGBA endpoint, swaps the served copy and rewrites `<data folder>/bridges/mgba.lua` through `installBridges`. Runs are chained, so two quick edits land in order. A host a script cannot carry (a name or a wildcard) logs a warning and leaves the old script served.
- `createSelector` takes an optional `scripted` list. It remembers the endpoint the script was made for and reports `scriptStale` per adapter in `/adapters`. Only a bridge hello moves that baseline, since a script can reach the program only at the endpoint baked into it.
- The Settings adapter list and the Connection screen add a note when `scriptStale` is true.
- Tests: six selector tests (changed port, changed host, unchanged, changed back, a hello moves the baseline, no script), a `generateBridges` test for host and port, a `createApp` test for a function source, a real-process test in `main.test.ts` that PUTs a changed and an unchanged mGBA port and checks the served script, the installed file and `/adapters`, and two viewer tests.

## Decisions

| Question | Options | Choice | By |
|---|---|---|---|
| How does the app serve the new script? | Mutate a shared record, rebuild the app, or read a getter per request | Getter per request. `createApp` stays unchanged for callers that pass a record. | Implementer |
| What does "stale" mean? | Any endpoint change since startup, or a script that has not connected since the change | The loaded script differs from the endpoint now in use and no script has connected on the current one. The baseline is the startup install until a hello moves it. | Implementer |
| Does a change back to the old endpoint stay stale? | Yes, or no | No. Round 1 caught that overwriting the baseline on each change left A to B to A stale. Stale is now computed from the baseline and the current endpoint. | Council seat, implementer |
| Where is stale reported? | A new route, a status field, or the `/adapters` entry | A `scriptStale` boolean on each `/adapters` entry, and a note in both adapter lists. | Implementer |
| Stale while the adapter is detached by a pin? | Only attached adapters, or every scripted one | Every scripted one, because the installed file goes stale whether or not the adapter is attached. | Implementer |
| Does it need a wire change? | Put the endpoint in the hello, or infer from the connection | Infer. A hello can only arrive from a script that holds the listening endpoint, so no protocol change. | Implementer |

## Audit

- Round 1: DISAPPROVE 7. One blocking problem fixed (A to B to A left the flag set). Two minor problems.
  - Install before assigning, so a failed write cannot split served and installed copies: rebutted. `installBridges` catches and logs its own write errors and never throws.
  - Note says "regenerated" when regeneration failed for a host name: reworded to "Load mgba.lua again."
- Round 2: APPROVE 8, four minor problems.
  - Only the port changes in the tests: fixed. Added a selector host test and a `generateBridges` host test.
  - A failed install write leaves a new served copy and an old installed file: declined, same rebuttal as round 1, and the log line is the existing signal.
  - A script loaded before a restart with a changed endpoint is not flagged: declined. That is a startup case. The ticket covers live changes.
  - For a host a script cannot carry, the note still says to load the script again: declined here and surfaced as a follow-up ticket.

## Checks

- `bun run typecheck` and `biome check` pass.
- Server tests: 1012 pass, 1 fail. The failure is the Lua 5.3/5.4 core test, because this machine has Lua 5.5. It is unrelated. Viewer: 272 pass. Internal: 26 pass.
- CI was not run, per the master's brief.

## Skipped gates

The commit gate was answered by the master's brief (commit every time). Steps 6 and 7 (CI) were skipped by the same brief. No PR was opened: the repo merges branches through the master thread.
