---
type: grilling
blocked_by: [041]
claimed_by: wayfinder-master v2-build-master-1794828615
claimed_at: 2026-11-16T11:30:15Z
---

# Does the runtime tier accept `Artistic-2.0` for domain-browser, or is the dependency replaced?

## Question

[Bun runtime notices manifest](./041-bun-runtime-notices-manifest.md) flags `domain-browser` as `blockedUntilAmendment` because `Artistic-2.0` isn't in the runtime tier that [Which licenses does the third-party allowlist accept?](./027-third-party-license-allowlist.md) set (amendment 027 item 7). Decide whether to add `Artistic-2.0` to the runtime tier, or to keep it out, and if so what the release does about the component Bun bundles. The `v2.0.0-beta.1` prerelease waits on this.

Record the answer as an amendment to [the 027 amendment](../assets/027-third-party-license-allowlist.md) that the spec section can cite. Don't edit `spec.md` in this ticket.
