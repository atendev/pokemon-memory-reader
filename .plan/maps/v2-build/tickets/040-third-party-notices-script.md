---
type: task
blocked_by: [027]
---

# Third-party notices script and CI check

## Question

Build `scripts/notices.ts` and its `ci.yml` step per [the 027 amendment](../assets/027-third-party-license-allowlist.md): strict SPDX parsing against the two allowlist tiers, overrides keyed by `name@version`, real license text required, and the notices file that `/about/third-party-notices.txt` serves per [Which routes serve the viewer's controls and info?](./021-viewer-control-routes.md).

## Acceptance

- Tests on checked-in package fixtures cover an allowed license, a disallowed one, an override, a missing license text and `LLVM-exception`.
- The CI step fails on a disallowed dependency.
