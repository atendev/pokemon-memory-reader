---
type: task
blocked_by: [052, 049]
---

# Online check for exception source URLs

## Question

Extend the online release check that [LGPL release check and source assets](./049-lgpl-release-check-assets.md) builds, per [amendment 044](../assets/027-third-party-license-allowlist.md#amendment-044-artistic-20-for-buns-domain-browser) item 5. It also fetches the `source` URL of every Bun manifest entry that a runtime entry exception matches, and fails the release if any URL doesn't resolve. The offline `notices --check` still fetches nothing.

## Acceptance

- The online check fails when an exception entry's `source` URL doesn't resolve, tested without the network.
