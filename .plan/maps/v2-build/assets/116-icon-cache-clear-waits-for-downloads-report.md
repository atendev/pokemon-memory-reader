# Make the icon cache clear wait for in-flight downloads: decision report

## Decisions

1. **Wait or drop.** Options: make `clearCache()` wait for every in-flight download, or drop the writes of downloads that began before the clear. Choice: drop. Each clear bumps a `generation` counter, and a download that started under an older generation skips its cache write. Waiting would hold the clear route open for up to the 5 s fetch timeout per download, and the stale answer would be written anyway. Made by: implementer.
2. **A write already under way.** A download that passed the generation check can be partway through `mkdir`, `writeFile` and `rename` when the clear runs. Choice: track those writes in a `writing` set and have `clearCache()` await it before deleting, so the rename can't land after the delete. Made by: implementer.
3. **Remembered misses.** A download that began before a clear and then gets a 404 or a bad PNG would put its path back into `missing`, which the clear just emptied. Choice: guard `missing.add` with the same generation check, so a clear forgets misses for good. Made by: implementer.
4. **The shared in-flight map.** A request after a clear would otherwise join a stale download through `inFlight` and get no cache write from it. Choice: `clearCache()` empties `inFlight`, and each download's `finally` deletes only its own entry. Made by: implementer.
5. **The stale download still answers.** Choice: the request that started the download still gets its bytes. Only the cache file and the remembered miss are dropped. Made by: implementer.
6. **Backoff.** Options: reset `backoffUntil` on a clear, or leave it. Choice: leave it. It records upstream health, not cache contents, and the ticket doesn't ask for it. Made by: implementer.
7. **Route.** `POST /settings/icon-cache/clear` is unchanged. Only `createIconService` and its tests changed.

## Audit

Council in single mode (Claude seat, haiku). Gemini and GPT: skipped. Round 1: APPROVE, score 8, no blocking problems.

## Minor problems

- Declined: the test "a clear waits for a cache write already under way" passes without the `await Promise.all(writing)` line. The window it guards is a write mid-flight at the moment of the clear. A test can't hit it reliably without mocking `node:fs`, which this suite doesn't do. The test stays as a timing guard and the code stays as written.

## Evidence

- `server/test/icons/service.test.ts` gains four tests: a download that finishes after a clear still answers its request and leaves no `.png` in the cache (the ticket's test), a request after a clear fetches fresh instead of joining the old download, a 404 that arrives after a clear isn't remembered, and the timing guard above. Against the old service, the first three fail.
- Server `bun test`: 1020 pass, 20 skip, 1 fail. The failure is the Lua 5.3/5.4 version check on a machine with Lua 5.5, a known local failure. `bun run typecheck` and `bunx biome check server` are clean.
- Repo rules: the ticket loop in `.plan/README.md` and the runner skill. Steps 5 to 7 were run as the master's brief set them: commit without asking, no CI run.
