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

---

`scripts/notices/bun-runtime.json` lists 199 components for Bun 1.4.2 (tag `bun-v1.4.2`), with 265 license texts under `scripts/notices/texts/`. `scripts/notices/bun-runtime.test.ts` fails when `packageManager` names a different Bun version. [Report](../assets/041-bun-runtime-notices-manifest-report.md).

- The list comes from the tag's native dependency pins, the cargo graph for eight targets (proc-macro crates left out), a scan of vendored source headers, and the polyfill lockfile closure.
- Two entries are outside the runtime tier: `bun_clap` (`Unlicense`) and `domain-browser` (`Artistic-2.0`). They carry `blockedUntilAmendment: true` and are not marked as passing, per amendment 027 item 7. The acceptance line "an SPDX expression the runtime tier accepts" is unmet for them until amendments land.
- Bun's own entry ships `LICENSE.md`, which has no copyright line or MIT grant. Whether that text is enough is an owner decision.
- tinycc is `-or-later`: its source headers say "version 2 ... or any later version".
- Still open: BoringSSL's seven files without the Apache header, JavaScriptCore's per-file census, per-target enablement of tinycc, lsquic and libwebp, simdutf's exact version and ICU's tag.
- The tier is enforced by `scripts/notices.ts` in [ticket 040](./040-third-party-notices-script.md), not by this test.
