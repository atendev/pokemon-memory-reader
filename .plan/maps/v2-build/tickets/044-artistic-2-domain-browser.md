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

## Answer

Neither tier takes `Artistic-2.0`, and Bun's dependency stays as it is. Bun's embedded `domain-browser@4.23.0` passes through an entry-scoped exception, a `RUNTIME_ENTRY_EXCEPTIONS` constant in `scripts/notices.ts`, keyed by exact `name@version` and ID, pinned by a test, and applied only to Bun manifest entries. A pin bump that changes the version fails the check until a new amendment approves it. The exception also prints a note saying that Bun's `LICENSE.md` MIT row for domain-browser appears to predate 4.23.0. Artistic-2.0 doesn't count as lax under the sibling `Unlicense` rule, because §5, §4 and §7 add conditions beyond keeping a notice. To meet §5, the manifest `source` becomes the npm tarball URL, and the online release check from 042 fetches it. The owner decided it in a grilling interview.

Excluded: adding `Artistic-2.0` to the runtime tier, putting the exception in the manifest, patching Bun to drop the polyfill, waiting for Bun to pin MIT 4.22.0, and attaching the tarball to each release.

Recorded as [amendment 044](../assets/027-third-party-license-allowlist.md#amendment-044-artistic-20-for-buns-domain-browser). [Report](../assets/044-artistic-2-domain-browser-report.md).
