---
type: task
blocked_by: [027]
claimed_by: wayfinder-master v2-build-master-1794807670
claimed_at: 2026-11-16T06:19:17Z
---

# Bun runtime notices manifest

## Question

Check in the Bun runtime notices manifest that [the 027 amendment](../assets/027-third-party-license-allowlist.md) describes, pinned to the `packageManager` Bun version, with the runtime tier's licenses and their real texts. The `v2.0.0-beta.1` prerelease waits on it.

## Acceptance

- The manifest lists every component the pinned Bun binary bundles, each with an SPDX expression the runtime tier accepts and its license text.
- A test fails when `packageManager` names a Bun version the manifest isn't pinned to.
