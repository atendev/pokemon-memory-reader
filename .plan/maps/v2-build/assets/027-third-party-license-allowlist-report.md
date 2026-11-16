# Decision report: Which licenses does the third-party allowlist accept?

This report covers [ticket 027](../tickets/027-third-party-license-allowlist.md). Its decisions are recorded in [the amendment](./027-third-party-license-allowlist.md).

This ran in auto mode under wayfinder-master. The main thread wrote the questions and a recommendation for each. A sonnet grilling subagent answered them over three rounds, and a haiku auditor checked the amendment. The master's brief skips the commit question, so the work is committed to the ticket branch without asking.

Before round 1, the main thread checked these facts. The production npm dependencies are hono, zod, react, react-dom and scheduler, all MIT. The viewer bundles no fonts or images. Bun is pinned once, in the root `package.json` `packageManager` (`bun@1.4.2`), which `ci.yml` reads. A sonnet research subagent listed the licenses of everything Bun links into a compiled executable, in [027-bun-runtime-licenses](./027-bun-runtime-licenses.md). It worked on Bun 1.4.4, the latest release at the time.

## Decisions

| # | Question | Options | Choice | Made by |
|---|---|---|---|---|
| 1 | One allowlist or tiers? | one flat list; two tiers; permissive with the runtime exempt | Two tiers. Weak copyleft is allowed only for Bun runtime manifest entries. | Grilling subagent |
| 2 | Which permissive IDs? | the spec's six; a wider list; that list plus BlueOak and Python-2.0 | The spec's six plus Zlib and Unicode-3.0, which runtime components need. MIT-0, BSL-1.0 and Unlicense were dropped after audit round 1, and CC0-1.0 after round 2, because nothing needs them. CC0 only ever appears as an `OR` branch that passes another way. | Grilling subagent, revised by the main thread after the audit |
| 3 | GPL-family IDs for third-party code? | none; allow GPL `-or-later`; none, and skip first-party packages | None. A first-party package is skipped only when it resolves to a workspace path in the repo. | Grilling subagent |
| 4 | Expression rules? | strict SPDX parse; also auto-normalise; also more exceptions | Strict parse, case-insensitive. `+` means `-or-later`, `-only` fails, and only `LLVM-exception` is allowed with `WITH`. | Grilling subagent |
| 5 | Overrides? | keyed by `name@version`; by name; none | `name@version`, with a reason and a text path. CI fails a stale override or a missing text path. | Grilling subagent |
| 6 | License text? | real text required; fall back to SPDX texts | Real text required. Apache `NOTICE` files are copied too. | Grilling subagent |
| 7 | Source for Bun runtime entries? | checked-in manifest; Bun's LICENSE.md only; generated live in CI | A checked-in manifest pinned to the `packageManager` version, built in its own task ticket that blocks beta.1 | Grilling subagent |
| 8 | Platform-specific entries? | one union file; a file per target | One union file, with platform-only entries marked | Grilling subagent |
| 9 | Dev dependencies that end up in the bundle? | a named list; walk all; ignore all | `EMBEDDED_DEV_PACKAGES`, which fails CI when a listed name is missing from the lockfile | Grilling subagent |
| 10 | How does the list change? | a constant pinned by a test; a JSON config | A constant pinned by a test. Adding an ID takes an amendment. | Grilling subagent |
| 11 | Walk a first-party package's dependencies? | yes; skip the subtree | Yes | Grilling subagent |
| 12 | Which release does the manifest block? | beta.1; RC only | beta.1 | Grilling subagent |
| 13 | Where does the check run? | `ci.yml` on every push and PR; release only | `ci.yml` `check` job, writing no files | Grilling subagent |
| 14 | Does the allowlist govern the api package? | no, unless its build bundles third-party code; always | No, with that condition | Grilling subagent |
| 15 | LGPL duties for statically linked JavaScriptCore and tinycc? | separate ticket blocking the RC; separate ticket blocking beta.1; no ticket | A separate grilling ticket. It now blocks beta.1. | Grilling subagent chose the RC. The main thread moved it to beta.1 after audit round 1. |
| 16 | Field and file disagree? | trust the field and override; a classifier | Trust the field. A human fixes a mismatch with an override. | Grilling subagent |
| 17 | Duplicates? | one entry per `name@version`; group identical texts | One entry each, sorted by name and then version | Grilling subagent |
| 18 | IJG (libjpeg-turbo)? | runtime tier; permissive tier | Runtime tier | Grilling subagent |
| 19 | libarchive's public-domain file? | the exact `LicenseRef-PublicDomain`; any `LicenseRef-*`; fail it | The exact ID only, in the runtime tier. It also covers ICU's tz data. | Grilling subagent; tz data added by the main thread after the audit |
| 20 | Why WTFPL and CC-BY-4.0 are excluded | not needed; admit them | Not needed. The FSF calls both GPL-compatible. | Grilling subagent, from the main thread's correction |

## Audit

Round 1 returned 13 problems:

- `LGPL-3.0-or-later` was in the runtime tier with nothing needing it.
- The permissive tier admitted IDs with no evidence behind them.
- CC0-1.0 and CC-BY-4.0 had different reasons for the same FSF caveat.
- The research covers Bun 1.4.4, but the pin is 1.4.2.
- Deferring the LGPL ticket to the RC contradicted the research.
- The tinycc, JavaScriptCore and ICU expressions were incomplete.
- Open research gaps had no owner.
- Manifest completeness had no check.
- Embedded JavaScript wasn't covered.
- The overrides file and the manifest could read as able to widen the list.

All 13 were fixed in the amendment.

Round 2 left one objection. CC0-1.0 only ever appears as an `OR` branch that passes through Apache-2.0 or BSD-2-Clause, so it fails item 2's own test, the same way MPL-1.1 does. CC0-1.0 was dropped. Round 3 returned APPROVE.

## Skipped gates

- The commit question in step 5, which the master's brief skips.
- The user interview for a grilling ticket, replaced by auto mode at the owner's standing answer.

## Surfaced tickets

- Third-party notices script and CI check (task).
- Bun runtime notices manifest (task). It blocks `v2.0.0-beta.1`.
- How do releases meet the LGPL terms for Bun's statically linked JavaScriptCore and tinycc? (grilling). It blocks `v2.0.0-beta.1`.
