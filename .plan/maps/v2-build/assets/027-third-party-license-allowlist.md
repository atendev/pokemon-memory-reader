# Third-party license allowlist: amendment for spec §17 item 15

Resolves [Which licenses does the third-party allowlist accept?](../tickets/027-third-party-license-allowlist.md). Cite it as "amendment 027".

This was decided in auto mode on 2026-11-16 (UTC). The main thread asked each question with a recommendation, and a sonnet grilling subagent answered over three rounds. The facts about Bun's runtime come from [027-bun-runtime-licenses](./027-bun-runtime-licenses.md).

It replaces the allowlist sentence in spec §13.5 ("MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD 'and similar'") and fills in how `scripts/notices.ts` checks it. §13.5's other rules stay: `scripts/notices.ts` walks the production closure of `server/` and `viewer/`, adds Bun's runtime and bundled assets, and writes `THIRD-PARTY-NOTICES.txt`, and CI fails on a missing license.

## Amendment

1. **Two tiers.** `scripts/notices.ts` exports both tiers as constants, and a test pins their exact contents.
   - **Permissive tier.** It applies to every entry: npm packages, Bun runtime components and bundled assets. `MIT`, `ISC`, `0BSD`, `BSD-2-Clause`, `BSD-3-Clause`, `Apache-2.0`, `Zlib`, `Unicode-3.0`. The first six are the IDs §13.5 names. Zlib (zlib-ng, libjpeg-turbo) and Unicode-3.0 (ICU) are needed by Bun's runtime, and the FSF calls both GPL-compatible. They sit in the permissive tier rather than the runtime tier because they are lax licenses with no copyleft terms.
   - **Runtime tier.** It applies only to entries in the Bun runtime manifest (item 7) and holds the permissive tier plus `LGPL-2.0-or-later`, `LGPL-2.1-or-later`, `MPL-2.0`, `IJG`, `blessing` and `LicenseRef-PublicDomain`. Bun's runtime needs these. The expressions below come from the research on Bun 1.4.4 and show that the tiers cover every known component. They are not manifest entries; item 7 sets those.
     - JavaScriptCore: `LGPL-2.0-or-later AND LGPL-2.1-or-later AND BSD-2-Clause AND BSD-3-Clause AND (MPL-1.1 OR GPL-2.0-or-later OR LGPL-2.1-or-later)`. BSD-3-Clause covers double-conversion. The last term covers JSDateMath.cpp and passes through `LGPL-2.1-or-later`.
     - tinycc: COPYING is LGPL-2.1, and the research reads the file headers as "or any later version". Either `-or-later` reading passes. If the 1.4.2 text reads as `-only`, the stop-and-amend rule in item 7 applies.
     - libjpeg-turbo: `IJG AND BSD-3-Clause AND Zlib`.
     - SQLite (Linux and Windows): `blessing`.
     - `LicenseRef-PublicDomain`: public-domain dedications with no SPDX list ID. Two are known, libarchive's `archive_parse_date.c` and ICU's tz data. The manifest vendors each dedication's text. The tier allows this one exact ID, not `LicenseRef-*` in general. Any other `LicenseRef-*` needs its own amendment and vendored text.
     - MPL-2.0: lol_html's Rust crates cssparser, selectors and dtoa-short.

     An npm package that needs a runtime-tier ID needs a new amendment first.
   - **Exception list.** `LLVM-exception` only, for libc++abi's `Apache-2.0 WITH LLVM-exception`.
2. **What qualifies for a tier.** An ID qualifies if the FSF license list calls it GPL-compatible, or if it is a plain permissive or public-domain grant. Qualifying is necessary but not enough. The ID must also be named in §13.5 or be needed by a known entry. `blessing` and `LicenseRef-PublicDomain` are the IDs the FSF list doesn't name. They qualify as public-domain grants, because the FSF says public-domain works are GPL-compatible. `LGPL-2.0` isn't on the FSF list either, so only its `-or-later` form is accepted, which can move to LGPL-2.1 or 3.0. Each tier ID's FSF wording or grant text is in [the research](./027-bun-runtime-licenses.md).
3. **Excluded.** Everything else. Nothing known needs these, and each needs an amendment to add:
   - `MIT-0`, `BSL-1.0`, `Unlicense`, `Unicode-DFS-2016`, `Python-2.0`, `LGPL-3.0-or-later`.
   - `BlueOak-1.0.0`: also not on the FSF list.
   - `WTFPL`: the FSF calls it GPL-compatible but advises against it.
   - `CC-BY-4.0`: the FSF calls it GPL-compatible but says CC licenses shouldn't be used for software. A future bundled asset under it, such as a font or image, needs an amendment.
   - IDs that appear only as one branch of an `OR` that passes another way: `CC0-1.0` (libarchive's blake2 files are `CC0-1.0 OR Apache-2.0 OR OpenSSL`, and HdrHistogram is `CC0-1.0 OR BSD-2-Clause`), `MPL-1.1` (JavaScriptCore's JSDateMath.cpp), `OpenSSL`, `Artistic-1.0-Perl` and `GPL-1.0-or-later`.
   - Every GPL-family and `-only` ID, such as `GPL-2.0-only`, `LGPL-2.1-only` and `GPL-3.0-or-later`, and `AGPL-3.0-*`. A third-party GPL dependency needs a deliberate amendment.
4. **Expressions.** `scripts/notices.ts` parses each license with an existing SPDX expression parser, so `AND` binds tighter than `OR`.
   - IDs match case-insensitively.
   - `OR` passes if any branch passes. `AND` passes only if every term passes in the entry's tier.
   - `WITH` passes if the base passes and the exception is on the exception list.
   - A `+` suffix reads as `-or-later`, so `LGPL-2.0+` is `LGPL-2.0-or-later`. `-only` never reads as `-or-later`.
   - These fail unless an override covers them: a missing `license` field, a legacy `licenses` array, a deprecated or non-SPDX string (`BSD`, `Apache 2.0`), `UNLICENSED`, and `SEE LICENSE IN …`. Nothing is normalised automatically.
   - Examples: `BSD-3-Clause OR GPL-2.0-only` passes through `BSD-3-Clause`. `MIT OR Artistic-1.0-Perl OR GPL-1.0-or-later` passes through `MIT`. JavaScriptCore's `MPL-1.1 OR GPL-2.0-or-later OR LGPL-2.1-or-later` (JSDateMath.cpp) passes through `LGPL-2.1-or-later`, and only in the runtime tier.
5. **First-party packages.** The walk skips a package when it resolves to a workspace path inside the repo. Starting with `@pokemon-memory-reader/` doesn't count, so a registry package with that scope is still checked. The walk skips only the first-party node and still walks that package's production dependencies, so zod is checked whether it comes in through `server/` or `api/`. Entries are keyed by `name@version`.
6. **License text.** Each entry needs real text: a `LICENSE*`, `LICENCE*` or `COPYING*` file in the package, or the text path from an override or the Bun manifest. An Apache-2.0 package's `NOTICE` file is copied too. An allowed ID with no text fails as a missing license. Canonical SPDX texts are never used as a fallback, because MIT and BSD texts carry the copyright line.
7. **Bun runtime manifest.** `scripts/notices/bun-runtime.json` is checked in.
   - It records the Bun version, and CI fails when that version differs from the root `package.json` `packageManager` (`bun@1.4.2`), the one pin CI and the build both read.
   - **Version gap.** The research was done on Bun 1.4.4, the newest release when it ran, and the pin is 1.4.2. The manifest ticket redoes the component list and every expression from the `bun-v1.4.2` sources, including that tag's `Cargo.lock`. The tiers in item 1 are set from the 1.4.4 evidence. Where 1.4.2 differs, the stop-and-amend rule below applies.
   - **What it lists.** Everything in the `bun` binary that `bun build --compile` copies for each target, whether or not the app uses it: statically linked C, C++ and Zig code, Rust crates, and embedded JavaScript such as the Node polyfills, each named. Each entry gets its own SPDX expression, the targets that include it, and a vendored text file under `scripts/notices/texts/`. Files the upstream source carries but the binary doesn't include (tests, tools, ICU's unlinked GPL-2.0+ files) are left out. Type declarations that ship only for `--aot` type checking count if the binary carries them for that target.
   - **Open items the manifest ticket must close.** The research left these open:
     - about 270 of roughly 305 Rust crates are unchecked;
     - 7 BoringSSL files lack the Apache header, and the fiat-crypto license choice isn't recorded;
     - JavaScriptCore's per-file census is a sample of about 12 files;
     - the Zig stdlib and vendored C under `src/` and `vendor/` weren't audited;
     - the polyfill list isn't enumerated;
     - HdrHistogram's link status is unknown;
     - which targets link tinycc, lsquic and libwebp is unverified.
   - **Stop and amend.** If any entry needs an ID outside the runtime tier, or an `-only` reading of an LGPL text, the manifest ticket stops and opens an amendment. It doesn't widen the list itself, and it doesn't commit the manifest with that entry marked as passing.
   - **Completeness is a review gate.** CI checks each entry's expression, its text and the Bun version. It can't check the manifest against the binary's real contents without network access or the Bun source. The manifest ticket's audit checks completeness instead, against the 1.4.2 tag's dependency list, `Cargo.lock` and per-target build config. Each later Bun pin bump redoes that review.
   - **LGPL.** For the LGPL components, the manifest carries the license texts and a pointer to the pinned Bun source tag. This amendment does not claim the LGPL terms for statically linked JavaScriptCore and tinycc are met. A separate ticket tracks that question (see Follow-ups).
   - Building the manifest is a separate task ticket and blocks `v2.0.0-beta.1`. A partial manifest can't ship as complete, because beta archives already carry `THIRD-PARTY-NOTICES.txt` (§13.4).
8. **Overrides.** `scripts/notices.overrides.json` is keyed by exact `name@version`. Each entry gives an SPDX expression, a reason and a license-text path, either in the package or vendored under `scripts/notices/texts/`. CI fails:
   - when an override's `name@version` is no longer in the closure (a stale override),
   - when its text path doesn't exist,
   - when its expression fails the entry's tier.

   No text classifier runs. The SPDX field is trusted. If a human finds that a package's license file disagrees with the field, they add an override, and the reason says so.
9. **Embedded dev packages.** `EMBEDDED_DEV_PACKAGES` in `scripts/notices.ts` names dev dependencies whose output ends up in the bundle, such as Tailwind's preflight CSS once the viewer adopts Tailwind. They're walked like production dependencies. Other dev dependencies are skipped. CI fails when a listed name is missing from the lockfile. The ticket that adopts Tailwind adds it to the list.
10. **One notices file.** One `THIRD-PARTY-NOTICES.txt` covers every archive. It holds the union across targets, and platform-only entries are marked, for example "Linux and Windows builds" for ICU and SQLite. Each `name@version` gets one entry with its own text, and identical texts are not deduplicated. Entries are sorted by name, then version. The check runs on the union.
11. **Where the check runs.** `ci.yml`'s `check` job runs `bun run notices --check` after `bun install --frozen-lockfile`. It runs on every push and PR, needs no other network access, and writes no files. It covers the tiers, the expressions, text presence, the manifest's Bun version, stale overrides and `EMBEDDED_DEV_PACKAGES`. The release build runs the generating mode before `bun build --compile`, as amendment 021 item 9 says.
12. **`@pokemon-memory-reader/api`.** The allowlist governs the app's notices only. The `api/` package declares zod as a dependency and bundles no third-party code. Amendment 012 owns its build. If that build ever bundles third-party code, the code must pass the permissive tier and the package must ship its own notices.
13. **Changing the list.** To add an ID, write an amendment that cites this one. The ID must meet item 2 and the change goes through review. The tiers live only in `scripts/notices.ts`. Neither the overrides file nor the manifest can widen them, and there is no environment switch.

## Spec sections this changes

- §13.5: the allowlist sentence, replaced by items 1 to 4, plus the walk, text, override, manifest and CI rules in items 5 to 11.
- §14 "Third-party notices": now cites this amendment.
- §17 item 15: resolved.

## Follow-ups

- **Third-party notices script and CI check** (task): build `scripts/notices.ts` with both modes, the tiers, the expression rules, overrides and `EMBEDDED_DEV_PACKAGES`, and add the `bun run notices --check` step to `ci.yml`.
- **Bun runtime notices manifest** (task): build `scripts/notices/bun-runtime.json` and the vendored texts from the `bun-v1.4.2` sources. It closes every open item in item 7 and blocks `v2.0.0-beta.1`.
- **How do releases meet the LGPL terms for Bun's statically linked JavaScriptCore and tinycc?** (grilling): a reading of LGPL-2.1 §6 for a compiled executable. It blocks `v2.0.0-beta.1`, because beta archives are the first compiled executables the project redistributes, and the research says the static-link terms apply to any of them. The grilling subagent first recommended blocking only the release candidate. The audit's point that beta.1 already redistributes the executable changed that.
