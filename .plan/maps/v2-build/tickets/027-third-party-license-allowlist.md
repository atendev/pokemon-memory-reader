---
type: grilling
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794807670
claimed_at: 2026-11-16T06:00:30Z
---

# Which licenses does the third-party allowlist accept?

## Question

Spec §17 item 15. The release pipeline lists MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0 and 0BSD "and similar". Settle an exact SPDX allowlist that `scripts/notices.ts` can check.

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

Decided in auto mode. Full rules are in [amendment 027](../assets/027-third-party-license-allowlist.md), and the decision trail is in [the report](../assets/027-third-party-license-allowlist-report.md).

- **Permissive tier, for every entry.** `MIT`, `ISC`, `0BSD`, `BSD-2-Clause`, `BSD-3-Clause`, `Apache-2.0`, `Zlib`, `Unicode-3.0`.
- **Runtime tier, for Bun runtime manifest entries only.** The permissive tier plus `LGPL-2.0-or-later`, `LGPL-2.1-or-later`, `MPL-2.0`, `IJG`, `blessing` and the exact `LicenseRef-PublicDomain`.
- **Exceptions.** `LLVM-exception` only.
- **Parsing.** `scripts/notices.ts` parses strict SPDX, case-insensitively. `OR` passes if any branch passes, and `AND` passes only if every term passes. `+` means `-or-later`, and `-only` fails. Non-SPDX strings fail unless an override covers them.
- **Overrides and text.** Overrides are keyed by `name@version` and fail CI when stale. Real license text is required, with no SPDX fallback.
- **Walk.** First-party workspace packages are skipped by path, but their dependencies are still walked. `EMBEDDED_DEV_PACKAGES` names dev packages whose output is bundled.
- **Bun runtime.** A checked-in manifest pinned to `packageManager` lists Bun's runtime components. Its completeness is a review gate.
- **Where it runs.** A `bun run notices --check` step in `ci.yml`.

Excluded:

- `MIT-0`, `BSL-1.0`, `Unlicense`, `Unicode-DFS-2016`, `Python-2.0`, `LGPL-3.0-or-later`, `BlueOak-1.0.0`, `WTFPL` and `CC-BY-4.0`. Nothing needs them, or the FSF advises against them.
- `CC0-1.0`, `MPL-1.1` and the other IDs that appear only as an `OR` branch passing another way.
- Every GPL-family, `-only` and AGPL ID.
- A wildcard `LicenseRef-*`.
- Auto-normalising non-SPDX strings.
- A config file.

Follow-ups: Third-party notices script and CI check (task), Bun runtime notices manifest (task, blocks beta.1), and the LGPL terms for statically linked JavaScriptCore and tinycc (grilling, blocks beta.1).
