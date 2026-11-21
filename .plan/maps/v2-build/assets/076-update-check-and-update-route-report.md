# Update check and the `/update` route: decision report

Ticket: [Update check and the `/update` route](../tickets/076-update-check-and-update-route.md) (task). Spec §9.8 and [amendment 021](./021-viewer-control-routes.md) item 10.

## Run

- The parent wayfinder-master session ran the Jev audit, so this child skipped it.
- The Gemini and GPT seats were out of quota, so the council ran with the Claude seat only, a haiku auditor. It returned APPROVE 8 in round 1. The other two seats count as `n/a`.
- The master's overrides replaced the commit gate and CI. This report is committed with the work. The branch never merges, and no CI run was started.
- Local checks: `bun run lint` and `bun run typecheck` pass. `bun test` has 1285 passing and one failing. The failing test is `the Lua core runs under Lua 5.3 or 5.4`, which pins 5.3 and 5.4 and sees the machine's Lua 5.5. This diff touches no bridge code.
- The repo merges branches locally and uses no PRs, so none was opened.

## What was built

- `internal/src/update.ts`: the `GET /update` body schema.
- `server/src/update/semver.ts`: semver parsing and precedence (`rc.2` before `rc.10`).
- `server/src/update/check.ts`: the checker. It runs at start and every 24 hours, drops a check that finishes after the setting went off, and prints one console line per newer version. `followUpdateSetting` carries a live `updateCheck` change to it.
- `GET /update` is an open read with a row in the route table. It has no write method.
- `main.ts` starts the check after the server is listening, so it never delays startup, and closes it at shutdown.
- `bunfig.toml` and `scripts/test-preload.ts` make `bun test` reject any `fetch` to a non-loopback host and set `PMR_UPDATE_CHECK=off` for programs the tests spawn. `scripts/smoke.ts` sets it too.

## Decisions

| # | Question | Options | Choice | Made by | Audit |
|---|---|---|---|---|---|
| 1 | What sets `checkedAt`? | Every attempt; only a check that got a usable list | Only a usable list. A failed check changes nothing, so the banner never shows a stale "checked" time for a failure | Implementer | Accepted |
| 2 | What counts as a prerelease release? | The feed's `prerelease` flag; a prerelease part in the version; either | Either. A stable build ignores a `v2.0.1` release that GitHub flags as prerelease, and a tag like `v2.0.1-rc.1` counts as one even if unflagged. A new test found that checking only the version let a flagged stable-looking tag through | Implementer, found by a new test | Accepted |
| 3 | What does a malformed feed do? | Fail the check; skip bad entries | Both. A body that isn't a list fails the check. Bad entries inside a list are skipped and the rest still count | Implementer | Accepted |
| 4 | When does the console line print? | Every check; once per version | Once per distinct newer version, so the 24-hour check doesn't repeat it | Implementer | Accepted |
| 5 | Does turning the setting off keep the last result? | Clear it; keep it but hide it | Keep it, and `state()` hides `latest` while off (item 10). Turning it on shows it again until the next check | Implementer | Accepted |
| 6 | How does no request leave the process in the suite? | Rely on the injected fake feed; also block it | Also block it. The preload rejects remote `fetch`, and `PMR_UPDATE_CHECK=off` covers `main.test.ts`, the executable e2e test and `smoke.ts`, which spawn the real program with the default setting on | Implementer | Accepted, see declined 2 |
| 7 | Where does the live `updateCheck` wiring live? | Inline in `main.ts`; an exported function | An exported `followUpdateSetting`, so a settings save test covers it through `PUT /settings` | Implementer | Accepted |
| 8 | How long after turning it on is the next check? | Any short delay; the spec says "shortly after" | 5 seconds, `ENABLE_DELAY_MS` | Implementer | Accepted |

## Declined minor problems

1. The viewer banner isn't in the diff. Declined: ticket 095, the viewer update banner, owns it, and the acceptance list here covers only the check and the route.
2. The preload guards only `globalThis.fetch`, not `node:http`, `Bun.connect` or `WebSocket`. Declined: the checker takes `fetch` by injection and `main.ts` passes the global one, so `fetch` is the only path an update request can take. The preload is a backstop for that path.
3. The `PMR_UPDATE_CHECK` gate in `main.ts` has no direct test. Declined: `server/test/cli/main.test.ts` and the executable e2e test spawn the real program under the preload, and the checker's own `enabled` flag has tests. A direct test would need a network listener to prove the absence of a request.

## Surfaced

- The README says the update check exists (spec §9.8). No ticket covers that line. It is a small docs task with no blocker.
