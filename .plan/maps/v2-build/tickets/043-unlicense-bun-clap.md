---
type: grilling
blocked_by: [041]
claimed_by: wayfinder-master v2-build-master-1794828615
claimed_at: 2026-11-16T11:30:15Z
---

# Does the runtime tier accept `Unlicense` for bun_clap, or is the dependency replaced?

## Question

[Bun runtime notices manifest](./041-bun-runtime-notices-manifest.md) flags `bun_clap` as `blockedUntilAmendment` because `Unlicense` isn't in the runtime tier that [Which licenses does the third-party allowlist accept?](./027-third-party-license-allowlist.md) set (amendment 027 item 7). Decide whether to add `Unlicense` to the runtime tier, or to keep it out, and if so what the release does about the component Bun bundles. The `v2.0.0-beta.1` prerelease waits on this.

Record the answer as an amendment to [the 027 amendment](../assets/027-third-party-license-allowlist.md) that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

Accepted, in the permissive tier rather than the runtime tier only. The owner decided this in a grilling interview on 2026-11-16. [Amendment 043](../assets/043-unlicense-bun-clap.md) adds `Unlicense`, `CC0-1.0`, `MIT-0`, `BSL-1.0` and `Unicode-DFS-2016` to the permissive tier, which the runtime tier includes. `bun_clap` passes as `Unlicense`, its `blockedUntilAmendment` flag goes, and Bun isn't patched or rebuilt.

Amendment 027 item 2's need rule no longer applies to lax IDs, meaning plain permissive or public-domain grants and IDs the FSF calls GPL-compatible. A lax ID is excluded only when the FSF recommends against it outright, as with WTFPL. Each addition still needs its own amendment.

Excluded: replacing `bun_clap` with a patched Bun, waiting for upstream, and putting `Unlicense` in the runtime tier only. `Python-2.0` stays out, and so do `CC-BY-4.0` and `BlueOak-1.0.0`, which qualify but weren't added now. `blessing` and `LicenseRef-PublicDomain` stay in the runtime tier. `Artistic-2.0` belongs to ticket 044. A new task ticket builds the change. [Report](../assets/043-unlicense-bun-clap-report.md).
