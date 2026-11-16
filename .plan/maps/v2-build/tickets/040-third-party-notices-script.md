---
type: task
blocked_by: [027]
claimed_by: wayfinder-master v2-build-master-1794807670
claimed_at: 2026-11-16T06:40:24Z
---

# Third-party notices script and CI check

## Question

Build `scripts/notices.ts` and its `ci.yml` step per [the 027 amendment](../assets/027-third-party-license-allowlist.md): strict SPDX parsing against the two allowlist tiers, overrides keyed by `name@version`, real license text required, and the notices file that `/about/third-party-notices.txt` serves per [Which routes serve the viewer's controls and info?](./021-viewer-control-routes.md).

## Acceptance

- Tests on checked-in package fixtures cover an allowed license, a disallowed one, an override, a missing license text and `LLVM-exception`.
- The CI step fails on a disallowed dependency.

---

`scripts/notices.ts` checks the production closure of `server/` and `viewer/` and the Bun manifest against the two SPDX tiers, with overrides keyed by `name@version`, real license text required and `EMBEDDED_DEV_PACKAGES`. `bun run notices --check` is the `ci.yml` step, and `bun run notices` writes `THIRD-PARTY-NOTICES.txt`. [Report](../assets/040-third-party-notices-script-report.md).

- `--check` warns on the two `blockedUntilAmendment` Bun entries (`bun_clap`, `domain-browser`). Generating mode and `--check --strict` fail on them. This deviates from amendment 027 item 11, and the auditor accepted it as recorded.
- 50 tests on checked-in package fixtures cover an allowed license, a disallowed one, an override, a missing license text and `LLVM-exception`. CI is green on 4c96870 (PR #26).
- Follow-ups: [run the generating mode in `release.yml`](../assets/040-third-party-notices-script-report.md), and gate `v2.0.0-beta.1` on tickets [043](./043-unlicense-bun-clap.md) and [044](./044-artistic-2-domain-browser.md) removing the flags.
