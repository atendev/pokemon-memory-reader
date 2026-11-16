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

## Open items from item 7

- **Closed:** Rust crates (all linked ones checked), polyfill list, HdrHistogram link status (compiled in), the vendored C and Zig sweep by copyright header.
- **Still open:** BoringSSL's seven files without the Apache header; JavaScriptCore's per-file census (sampled); per-target enablement of tinycc, lsquic and libwebp (listed for every target); simdutf's exact version; ICU's tag (release-78.1 assumed). LICENSE.md still lists Tigerbeetle's Windows IO code, but no 1.4.2 source references it, so it has no entry.
- **Needs an amendment:** `Unlicense` (bun_clap) and `Artistic-2.0` (domain-browser). Nothing in this ticket's test enforces the tier: the tiers live only in `scripts/notices.ts` (amendment 027 item 13), which [ticket 040](../tickets/040-third-party-notices-script.md) builds. Its `--check` is what fails on both entries until an amendment lands. This test only checks that they stay flagged. The ticket's acceptance line "an SPDX expression the runtime tier accepts" is therefore not met for these two entries.
- **Also open (round 1 audit).** Bun's own MIT entry ships `LICENSE.md`, which has no copyright line or MIT grant, so its text is weaker than a real MIT text. The tests check that text files exist and are non-empty, not that a text matches its SPDX ID. `lol-html` is the C API build and `lol_html` the Rust crate (both compiled), so they are two entries. `OR` expressions pass if any branch is in the tier (item 4), so entries don't record a chosen branch.
