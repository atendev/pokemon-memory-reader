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

## Handoff

Branch t3/bun-runtime-notices-manifest, work commit 750967b plus the report fix. Done: manifest (199 components), 266 texts, test, report; tests, tsc and biome pass. Generator was a throwaway in /tmp (gone); regenerate by hand only if needed.
Left, in order:
1. Audit round 1 returned NOT APPROVED (points: tier not enforced here, bun MIT text weak, text-vs-SPDX unchecked, no branch recorded, lol-html duplicate). Report is fixed to state these as open or by design. Start a new haiku auditor, send it the changed report hunk and these objections, and count from round 2.
2. Optionally record the chosen branch in notes for the OR entries (WebKit, picohttpparser, zstd).
3. On APPROVE: push without forcing, open a PR against wayfinder/v2-build-master if the repo uses PRs, return PUSHED.
Surface on DONE: amendment tickets for `Unlicense` (bun_clap) and `Artistic-2.0` (domain-browser). Read first: the report in assets/041-bun-runtime-notices-manifest-report.md.
