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

## Answer

`scripts/lgpl-sources.ts` (`bun run lgpl-sources`) reads the Bun, WebKit and tinycc pins from `scripts/notices/bun-runtime.json`. `build` fetches each source from upstream at its pin and writes a deterministic `.xz` archive plus its `SHA256SUMS` line. A failed fetch throws, so the release fails. An archive at or above 2 GiB is split into numbered 1900 MiB parts, each with its own `SHA256SUMS` line. `body <file> --tag <tag>` adds the source-offer section to the release body.

`check` is the offline check. It makes no network call and runs in the default suite, with a missing or extra `SHA256SUMS` line as a failure. `check --online` fails when a pinned commit does not resolve upstream, and with `--release <tag> --repo <r>` it also fails when a source asset is missing from the release. `.github/workflows/lgpl-pins.yml` runs the online check on pull requests that touch the pins, and `ci.yml` gets a `rehost-smoke` job. 36 tests in `scripts/lgpl-sources.test.ts` pass.

`release.yml` does not exist, so the calls wait under the beta.1 fog like [the 039 body step](./039-signature-evidence-in-release-body.md). It should run `bun run lgpl-sources build`, `body <file> --tag <tag>` and `check --online --release <tag> --repo <r>` before publishing. [Ticket 053](./053-online-check-exception-sources.md) extends the online check.

Excluded: a real full-size WebKit build and the exact 2 GiB boundary, both unproven after an out-of-memory failure. The split is tested with an injected threshold, and the live `check --online` passed against GitHub.

Report: [049 report](../assets/049-lgpl-release-check-assets-report.md). Audit: APPROVE in round 2, two seats (Claude 8, Gemini 9), the GPT seat being out of quota with the owner's approval for this ticket only. Two minor problems declined. CI was not run for this branch.

Timing: wall 42m, active 13m, user 0s, wait 29m, blocked 0s | setup 37s, implement 34m, audit 7m (2 rounds), record 32s | tools 76 (7 subagent) | limits 0, compactions 0, handoffs 1 | ctx peak 157k | cost $2.65 sonnet-5-5 + $0.02 haiku-5-5
