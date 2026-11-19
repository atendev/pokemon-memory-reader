# LGPL release check and source assets: decision report

Ticket: [LGPL release check and source assets](../tickets/049-lgpl-release-check-assets.md). Built on branch `t3/lgpl-release-check-assets`, picked up on `t3/lgpl-release-check-assets-2`. The `wayfinder-runner` skill's rules applied, because the repo has no `workflow.md` that sets its own loop.

## Audit

APPROVE in round 2 of 5. Round 1: Claude 8, Gemini 9. Round 2: Claude 8, Gemini 9.

This was a two-seat audit. The GPT seat was out of quota, and the owner approved a two-seat audit for this ticket only. The GPT seat was not retried. Round 2 covered the fixes to Claude's minor problems. Gemini's last minor problem, the guard that was re-evaluated inside the loop, was fixed with a test afterwards and not re-audited.

## Decisions

1. **Where the pins come from.**
   - Question: where does the script get the Bun, WebKit and tinycc commits?
   - Choice: `readPins()` reads `scripts/notices/bun-runtime.json`, the file the 042 amendment names, so a pin bump needs no script edit.
   - Made by: main thread.

2. **One script with subcommands.**
   - Question: separate scripts for build, body and check, or one?
   - Choice: `scripts/lgpl-sources.ts` with `build`, `body <file> --tag <tag>` and `check [--online [--release <tag> --repo <r>]]`, run as `bun run lgpl-sources`. The workflow ticket gets three one-line calls.
   - Made by: main thread.

3. **Building the archives.**
   - Each archive is fetched from upstream at its pin and compressed with `xz`. Output is deterministic (a test runs the build twice and compares hashes), and each archive's hash goes into `SHA256SUMS`.
   - A failed fetch throws, so the build exits non-zero and the release fails.
   - Made by: main thread. The determinism test came from a Claude minor in round 1.

4. **Splitting WebKit.**
   - Question: what happens to an archive at or above 2 GiB?
   - Choice: `splitIfLarge` splits it into numbered parts of 1900 MiB (`split -b 1900M`), and the parts get their own `SHA256SUMS` lines. The threshold is injectable.
   - Made by: main thread.

5. **Offline check.**
   - `checkOffline` reads the manifest, the relink doc and the notices with no network call. It runs in the default test suite.
   - `checkAssets` compares a release's asset list and `SHA256SUMS` against the pins. It flags a missing archive or part, and extra `SHA256SUMS` lines. A problem is reported once, not duplicated.
   - Made by: main thread. The extra-lines check and the no-duplicates rule came from Claude's round 1 minors.

6. **Online check.**
   - `checkOnline` fails when a pinned commit does not resolve upstream. With `--release <tag> --repo <r>` it also fails when a source asset is missing from that release.
   - The network sits behind an `Upstream` interface, so tests inject a fake. The real GitHub implementation, `githubUpstream`, is the default.
   - Made by: main thread.

7. **CI wiring.**
   - Options: add the online check to the main CI, or put it in its own workflow.
   - Choice: `.github/workflows/lgpl-pins.yml` runs `check --online` on a pull request that touches the pin file, `package.json`, the script or the relink doc. The main CI stays offline. A `rehost-smoke` job in `ci.yml` compiles onto a copy of the official Bun, which shows the app can be re-hosted.
   - Made by: main thread.

8. **`release.yml` does not exist.**
   - Question: write a whole `release.yml` for this ticket?
   - Choice: no. The commands are ready, and the call waits under the beta.1 fog like [ticket 039](../tickets/039-signature-evidence-in-release-body.md).
   - Made by: main thread.

9. **Guard inside the loop.**
   - Gemini's last minor problem: the guard was re-evaluated inside the loop. Fixed with a test by the main thread, not re-audited.

## Declined minor problems

Two, both about the same limit: the 2 GiB boundary and a real WebKit build are unproven. A real full-size build is forbidden after an out-of-memory failure, so the split is tested with an injected threshold. The live `check --online` run against GitHub passed.

## Verification

36 tests in `scripts/lgpl-sources.test.ts` pass, re-run on pickup. Lint, typecheck and `notices --check` passed on the handoff commit. The full suite's only failure is the Lua 5.3 test, because `lua5.3` is not installed locally. CI was not run for this branch, by instruction.

## For the beta.1 `release.yml`

It should call `bun run lgpl-sources build`, `bun run lgpl-sources body <file> --tag <tag>`, and `bun run lgpl-sources check --online --release <tag> --repo <r>` before publishing. [Ticket 053](../tickets/053-online-check-exception-sources.md) extends the online check.
