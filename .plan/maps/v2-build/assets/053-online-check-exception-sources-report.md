# Online check for exception source URLs: decision report

The online LGPL check now also requests the `source` URL of every Bun manifest entry that a runtime entry exception matches, and fails if one doesn't resolve. Today that is one URL, the npm tarball for `domain-browser@4.23.0`. The offline checks fetch nothing.

## Decisions

1. **Where the check lives.**
   - Question: which script owns the check?
   - Options: `scripts/lgpl-sources.ts` (the online check from ticket 049), `scripts/notices.ts`, or a new script.
   - Choice: `lgpl-sources.ts`. It already has the `Upstream` seam that tests stub, and `notices.ts` must stay offline.
   - Made by: main thread. Audit: approved.

2. **How the exceptions reach the check.**
   - Question: does `checkOnline` read the manifest itself, or take the sources as an argument?
   - Options: read inside, or take `exceptionSources` as a fourth optional parameter.
   - Choice: a parameter, so tests pass any list. `readExceptionSources()` builds it from `RUNTIME_ENTRY_EXCEPTIONS` and the manifest, and the CLI passes it. The existing three-argument calls and tests are unchanged.
   - Made by: main thread. Audit: approved.

3. **Stale exceptions.**
   - Question: what happens to an exception with no manifest entry?
   - Choice: skip it here. `notices --check` already fails it offline (ticket 052), so a second failure would only repeat that.
   - Made by: main thread. Audit: approved.

4. **What counts as "resolves".**
   - Question: which responses pass?
   - Choice: a success status after redirects passes. 404 and 410 fail as "does not resolve". Any other status, or a network error, fails as "could not fetch". Both fail the release, and the message says which.
   - An empty or non-http(s) `source` fails with no request, so a `file:` URL can't be fetched.
   - Made by: main thread. Audit: approved.

5. **Request method.**
   - Question: HEAD or GET?
   - Choice: HEAD, so a tarball isn't downloaded. A live `curl -I` against the domain-browser tarball returned 200.
   - Made by: main thread. Audit: approved.

6. **Testing without the network.**
   - The `Upstream` stub gains `urlResolves`.
   - Tests cover the stub passing and failing, a thrown error, bad URLs that make no request, one bad URL among good ones, and the real manifest and exception list.
   - `githubUpstream.urlResolves` runs against a `Bun.serve` server on localhost, covering 200, a redirect, 404, 410, 503 and a closed port.
   - A test replaces `fetch` with a thrower and runs the offline `checkOffline`, so it fails if the offline check ever requests anything.
   - 47 tests in `scripts/lgpl-sources.test.ts` pass, the whole `scripts` suite (245) passes, and `tsc` and `biome ci` are clean.

## Audit

Council audit, Claude seat only: APPROVE in round 1, score 8. The Gemini and GPT seats are not run (quota). Auto mode was on.

Minor problems declined, both from one seat:

- **No GET fallback when a host rejects HEAD (405 or 403).** Declined. The only URL is the npm registry, which answers HEAD with 200 (checked). A host that refuses HEAD fails the release loudly, never silently, and the fix is one line if it happens. The fix would also make the approval stale and cost another round.
- **The offline test covers `lgpl-sources check`, not `notices --check`.** Declined. This ticket doesn't touch `scripts/notices.ts`, and it has no `fetch` or process spawn (`grep` finds none), so `notices --check` stays offline by construction.

## Left out

- `release.yml` doesn't exist, so nothing calls `check --online --release` yet. The wiring waits under the beta.1 fog, as in ticket 049. `.github/workflows/lgpl-pins.yml` already runs `check --online` on pins pull requests, so it now covers the exception URLs too.
- CI was not run for this branch. The master runs it on the merged batch.
