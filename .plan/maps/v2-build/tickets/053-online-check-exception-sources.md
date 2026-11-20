---
type: task
blocked_by: [052, 049]
claimed_by: wayfinder-master v2-build-master-1795197565
claimed_at: 2026-11-20T18:02:00Z
---

# Online check for exception source URLs

## Question

Extend the online release check that [LGPL release check and source assets](./049-lgpl-release-check-assets.md) builds, per [amendment 044](../assets/027-third-party-license-allowlist.md#amendment-044-artistic-20-for-buns-domain-browser) item 5. It also fetches the `source` URL of every Bun manifest entry that a runtime entry exception matches, and fails the release if any URL doesn't resolve. The offline `notices --check` still fetches nothing.

## Acceptance

- The online check fails when an exception entry's `source` URL doesn't resolve, tested without the network.

## Answer

`bun run lgpl-sources check --online` now also requests the `source` URL of every Bun manifest entry that a runtime entry exception matches, which today is the npm tarball for `domain-browser@4.23.0`. A URL that answers 404 or 410 fails as "does not resolve". Any other status or a network error fails as "could not fetch". An empty or non-http(s) `source` fails without a request. An exception with no manifest entry is skipped, since `notices --check` already fails it offline.

`readExceptionSources()` builds the list from `RUNTIME_ENTRY_EXCEPTIONS` and the manifest, `checkOnline` takes it as an optional fourth argument, and the CLI passes it. `Upstream` gained `urlResolves`, which uses a HEAD request. The offline `check` and `notices --check` fetch nothing, and a test pins that. 47 tests in `scripts/lgpl-sources.test.ts` pass with a stubbed upstream and a local server, and the scripts suite (245), `tsc` and `biome ci` are clean. `lgpl-pins.yml` now also triggers on `scripts/notices.ts`, where the exception list lives.

Excluded: a GET fallback for hosts that reject HEAD, declined because the npm registry answers HEAD (200, checked live). `release.yml` doesn't exist, so the release call waits under the beta.1 fog like ticket 049.

Report: [053 report](../assets/053-online-check-exception-sources-report.md). Audit: APPROVE in round 1, Claude seat only (8), Gemini and GPT not run (quota). Two minor problems declined. CI was not run for this branch.

Timing: wall 2m, active 2m, user 0s, wait 0s, blocked 0s | implement 1m, audit 32s (1 round) | tools 19 (2 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 80k | cost $0.67 sonnet-5-5 + $0.01 haiku-5-5
