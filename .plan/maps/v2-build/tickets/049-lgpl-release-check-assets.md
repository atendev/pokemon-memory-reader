---
type: task
blocked_by: [047, 048]
---

# LGPL release check and source assets

## Question

Per [the 042 amendment](../assets/042-bun-lgpl-terms.md): every release attaches the Bun, tinycc and WebKit source archives from the `pmr-bun-v<ver>` tags, and offline and online release checks confirm the assets and notices.

## Acceptance

- The offline check runs in tests with no network call, and the online check fails when a source asset or tag is missing.
