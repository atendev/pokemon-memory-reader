---
type: task
blocked_by: [048]
---

# LGPL release check and source assets

## Question

Per [the 042 amendment](../assets/042-bun-lgpl-terms.md): `scripts/lgpl-sources.ts` reads the pins from `scripts/notices/bun-runtime.json`, fetches Bun, tinycc and WebKit from upstream at those pins, and builds the source archives. `release.yml` runs it, attaches the archives to every release and lists them in `SHA256SUMS`, with no manual step. Offline and online release checks confirm the assets and notices.

## Acceptance

- Running the script builds the three archives (WebKit split into numbered parts at 2 GiB or more), and a failed fetch fails the release.
- The offline check runs in tests with no network call, and the online check fails when a pinned commit doesn't resolve or a source asset is missing.
