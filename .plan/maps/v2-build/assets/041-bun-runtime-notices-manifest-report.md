# Bun runtime notices manifest: decision report

Ticket: [Bun runtime notices manifest](../tickets/041-bun-runtime-notices-manifest.md). Cites [amendment 027](./027-third-party-license-allowlist.md) item 7.

## What was built

- `scripts/notices/bun-runtime.json`: 199 components for Bun 1.4.2 (tag `bun-v1.4.2`, commit 744846f). Each has a name, version, SPDX expression, kind, source URL, targets and vendored text paths.
- `scripts/notices/texts/`: the license texts, copied from the pinned commits, the Bun source tarball, the cargo registry sources and the npm packages.
- `scripts/notices/bun-runtime.test.ts`: fails when `packageManager` names a Bun version the manifest isn't pinned to. It also checks uniqueness, sort order, targets, non-empty text files and the amendment flags.

## How the list was found

- **Native deps.** Read from `scripts/build/deps/*.ts` at the tag: 21 pins. Texts come from each pinned commit. libwebp's commit isn't on GitHub, so its text comes from the v1.6.0 tag.
- **Rust crates.** `cargo metadata --filter-platform` for eight triples, walking normal edges from `bun_runtime` and `bun_shim_impl` and skipping proc-macro crates. That gives 67 external crates, plus Bun's own workspace crates under the `bun` entry. `lol_html` and `rust-argon2` come from the build-time `vendor/` clones at their pins.
- **Vendored source.** Scanned the tag's `src/` and `packages/` for third-party copyright headers. This found uSockets, uWebSockets, zig-clap, the Mozilla root certificates, Node.js-derived code, the React Compiler port, glob-match, Zig and kprotty thread code, and diff-match-patch.
- **Polyfills.** The `src/node-fallbacks/bun.lock` closure, installed in a scratch directory: 94 npm packages.

## Decisions

| Question | Choice | By |
|---|---|---|
| Does a Rust crate that only a proc macro uses count? | No. Proc macros run at compile time and aren't linked. | implementer |
| `MIT/Apache-2.0` style legacy strings | Rewritten to SPDX `MIT OR Apache-2.0`, with a note on the entry. | implementer |
| Packages with no license file | Use the README's license section (seven Indutny packages) or the upstream repo's file, and say so in the entry's notes. | implementer |
| Bun's own license text | `LICENSE.md` as shipped. It states MIT but carries no copyright line or MIT text. | implementer |
| Highway SPDX | `Apache-2.0`. The pinned tree ships only that LICENSE. | implementer |
| zig-clap (`Unlicense`) and domain-browser (`Artistic-2.0`) | Recorded with their real IDs and `blockedUntilAmendment: true`. Neither is in the runtime tier. The manifest does not widen the tier. | implementer, per item 7 |
| Which branch of an `OR` expression passes? | The entry's notes name it (WebKit through `LGPL-2.1-or-later`, picohttpparser through `MIT`, zstd through `BSD-3-Clause`). | implementer, after audit round 1 |
| Is tinycc `-or-later` or `-only`? | `-or-later`. Its source headers say "version 2 ... or any later version". | implementer, after audit round 2 |
| Does 041 finish with two blocked entries and a weak Bun text? | It returns them as surfaced tickets to the master. It does not mark them as passing and does not invent a copyright holder. | implementer, after audit rounds 2 and 3 |

## Open items from item 7

- **Closed.** Rust crates (all linked ones checked), polyfill list, HdrHistogram link status (compiled in), the vendored C and Zig sweep by copyright header.
- **Still open.** BoringSSL's seven files without the Apache header; JavaScriptCore's per-file census (sampled); per-target enablement of tinycc, lsquic and libwebp (listed for every target); simdutf's exact version; ICU's tag (release-78.1 assumed). LICENSE.md still lists Tigerbeetle's Windows IO code, but no 1.4.2 source references it, so it has no entry.
- **Needs an amendment.** `Unlicense` (bun_clap) and `Artistic-2.0` (domain-browser). Nothing in this ticket's test enforces the tier: the tiers live only in `scripts/notices.ts` (amendment 027 item 13), which [ticket 040](../tickets/040-third-party-notices-script.md) builds. Its `--check` is what fails on both entries until an amendment lands. This test only checks that they stay flagged. The ticket's acceptance line "an SPDX expression the runtime tier accepts" is therefore not met for these two entries.
- **tinycc header check.** The headers of `tcc.c`, `libtcc.c` and `tccgen.c` at the pinned commit (`https://raw.githubusercontent.com/oven-sh/tinycc/05f0fafaa3be31e31d7b4b5c17dc60f62c991171/<file>`, lines 7 to 9) read "version 2 of the License, or (at your option) any later version". So tinycc is an `-or-later` reading, not `-only`, and item 7's stop rule for LGPL doesn't fire. The entry keeps `LGPL-2.1-or-later` to match its `COPYING`.
- **Open from audit round 1.** Bun's own MIT entry ships `LICENSE.md`, which has no copyright line or MIT grant, so its text is weaker than a real MIT text. The tests check that text files exist and are non-empty, not that a text matches its SPDX ID. `lol-html` is the C API build and `lol_html` the Rust crate (both compiled), so they are two entries. `OR` expressions pass if any branch is in the tier (item 4), so entries don't record a chosen branch.

- **Round 2 audit points.** The auditor said 041 can't finish with the two blocked entries. Item 7 says to stop and open an amendment rather than mark them as passing. The manifest does that: both stay flagged `blockedUntilAmendment`, none is marked as passing, and the amendment tickets are returned to the master as surfaced tickets. The `bun` entry's weak text is the same kind of owner decision: a surfaced ticket asks whether to accept Bun's `LICENSE.md` as is or add a real MIT text with a copyright holder. This ticket won't invent one.

## Audit

One haiku auditor per ticket. Round 1 (previous thread) and rounds 2 and 3 returned problems. Round 4 returned APPROVE, with the open items above kept as recorded decisions. Fixes along the way: the OR branch notes, the tinycc header evidence with the pinned-commit URL, and the text count of 265. The auditor could not fetch the tinycc headers itself, so that evidence rests on the implementer's fetch.

## Surfaced tickets

- Amendment to the runtime tier for `Unlicense` (bun_clap), or a replacement for it.
- Amendment to the runtime tier for `Artistic-2.0` (domain-browser), or a replacement for it.
- Owner decision on Bun's own MIT text: accept `LICENSE.md` as shipped, or add a full MIT text with a copyright holder.
