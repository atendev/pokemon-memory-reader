---
type: task
blocked_by: [048]
claimed_by: wayfinder-master v2-build-master-1795069748
claimed_at: 2026-11-19T06:35:00Z
---

# LGPL release check and source assets

## Question

Per [the 042 amendment](../assets/042-bun-lgpl-terms.md): `scripts/lgpl-sources.ts` reads the pins from `scripts/notices/bun-runtime.json`, fetches Bun, tinycc and WebKit from upstream at those pins, and builds the source archives. `release.yml` runs it, attaches the archives to every release and lists them in `SHA256SUMS`, with no manual step. Offline and online release checks confirm the assets and notices.

## Acceptance

- Running the script builds the three archives (WebKit split into numbered parts at 2 GiB or more), and a failed fetch fails the release.
- The offline check runs in tests with no network call, and the online check fails when a pinned commit doesn't resolve or a source asset is missing.

## Handoff

Branch `t3/lgpl-release-check-assets`. Code is final and committed (see HEAD SHA below). Nothing left to build.

**Done.** `scripts/lgpl-sources.ts` (`build`, `body`, `check [--online [--release <tag> --repo <r>]]`, `bun run lgpl-sources`) with 36 tests in `scripts/lgpl-sources.test.ts`. `.github/workflows/lgpl-pins.yml`, a `rehost-smoke` job in `ci.yml`, and `REPO_URL` exported from `scripts/notices.ts`. Lint, typecheck and `notices --check` pass. The only failing test is the Lua 5.3 test (`lua5.3` not installed locally, unrelated). The live `check --online` passed against GitHub. A real full-size build was never run, by instruction. Scratch goes under gitignored `out/`, never `/tmp`.

**Audit.** The owner accepted a two-seat audit (Claude + Gemini) because the GPT seat is out of quota. Do not retry GPT. Round 1: claude 8, gemini 9. Round 2 (fixes to claude's minors: xz determinism test, extra `SHA256SUMS` lines flagged in `checkAssets`, no duplicate messages): claude 8, gemini 9. Gemini's last minor (guard re-evaluated inside the loop) was fixed with a test and not re-audited. Audit rounds used: 2 of 5. Declined minors: the 2 GiB boundary and a real WebKit build are unproven (forbidden after the OOM; split tested with an injected threshold).

**Left, in order.**
1. Write `.plan/maps/v2-build/assets/049-lgpl-release-check-assets-report.md` (decisions, options, who decided, audit verdicts, declined minors, the two-seat note and reason). Run `unslop` on it.
2. Add `## Answer` to this ticket (`release.yml` does not exist, so the call waits under the beta.1 fog like ticket 039; the commands are ready). Delete this Handoff section.
3. Run the Timing close: `python3 -I ~/.claude/skills/wayfinder-runner/wf-time.py close --slug v2-build --ticket 049 --name 'LGPL release check and source assets' --ticket-file .plan/maps/v2-build/tickets/049-lgpl-release-check-assets.md`.
4. Commit (normal subject, no co-author clause), push without forcing, return DONE with the Decision line. Leave map.md alone.

**Files to read first.** `scripts/lgpl-sources.ts`, `.plan/maps/v2-build/assets/042-bun-lgpl-terms.md` §4-§7.

**Surface for the master.** The beta.1 `release.yml` should run `bun run lgpl-sources build`, `body <file> --tag <tag>` and `check --online --release <tag> --repo <r>` before publishing. Ticket 053 extends `checkOnline`.
