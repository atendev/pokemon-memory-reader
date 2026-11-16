# Lax IDs in the permissive tier: amendment for spec §13.5

Resolves [Does the runtime tier accept `Unlicense` for bun_clap, or is the dependency replaced?](../tickets/043-unlicense-bun-clap.md). It changes items 1, 2 and 3 of the [027 amendment](./027-third-party-license-allowlist.md). Cite it as "amendment 043".

The owner decided this in a grilling interview on 2026-11-16 (UTC). The main thread asked each question with a recommendation.

## Facts

- `bun_clap` is Bun's own command-line parser, a port of zig-clap vendored at `src/clap` in the `bun-v1.4.2` tag (commit `744846f844374847c902b5e7fd59b4342a51ef99`, per [amendment 045](./045-bun-license-text.md)). Its `LICENSE` is the Unlicense text. The checked-in manifest `scripts/notices/bun-runtime.json`, built by [ticket 041](./041-bun-runtime-notices-manifest-report.md), records it as `spdx: "Unlicense"` for all six targets, with that text already vendored at `scripts/notices/texts/bun_clap_1.4.2__LICENSE.txt`. `bun build --compile` copies the whole `bun` binary. The only ways to remove it are a custom-built Bun or a Bun release that drops or relicenses it.
- Amendment 027 left `Unlicense`, `CC0-1.0`, `MIT-0` and `BSL-1.0` out because nothing needed them, not because of their terms ([027 report](./027-third-party-license-allowlist-report.md), row 2). For CC0 the same row adds that it only appears as an `OR` branch that passes another way, which is why item 3 of 027 lists it in that group.
- The FSF license list (gnu.org/licenses/license-list.html, read 2026-11-16) says:
  - Unlicense (#Unlicense): "Both public domain works and the lax license provided by the Unlicense are compatible with the GNU GPL." It gives no recommendation against it.
  - CC0 (#CC0): public-domain dedication with a fallback lax license, both GPL-compatible. The FSF does not recommend it for software because it grants no patent license.
  - MIT-0 is listed as "Expat No Attribution License" (#Expat0) among the GPL-compatible licenses, with the same comments as 0BSD.
  - Boost Software License (#boost): "a lax, permissive non-copyleft free software license, compatible with the GNU GPL."
  - Unicode, Inc. License Agreement for Data Files and Software (#Unicode): "a lax permissive license, compatible with all versions of the GPL", with "Please do not use this License Agreement for your own software."
  - WTFPL: "We do not recommend this license."
  - From the [027 research](./027-bun-runtime-licenses.md): Python-2.0 is compatible "for 2.0.1+", and the FSF flags plain 2.0 as the intermediate version with a different license. CC-BY-4.0 is "compatible with all versions of the GNU GPL; however, like all CC licenses, it should not be used on software." BlueOak-1.0.0 has no FSF entry.
- `byteorder` and `memchr` in the Bun manifest are `Unlicense OR MIT` and already pass through `MIT`.

## Amendment

1. **Permissive tier.** Item 1's permissive tier gains `Unlicense`, `CC0-1.0`, `MIT-0`, `BSL-1.0` and `Unicode-DFS-2016`. It now reads `MIT`, `ISC`, `0BSD`, `BSD-2-Clause`, `BSD-3-Clause`, `Apache-2.0`, `Zlib`, `Unicode-3.0`, `Unlicense`, `CC0-1.0`, `MIT-0`, `BSL-1.0`, `Unicode-DFS-2016`. The runtime tier includes the permissive tier, so it gains them too. npm packages, Bun runtime entries and bundled assets may all use them.
2. **bun_clap.** The `bun_clap` entry keeps `spdx: "Unlicense"` and its vendored text, and passes the runtime tier through item 1. Its `blockedUntilAmendment` flag is removed, along with the "NEEDS AMENDMENT" note. Bun is not patched or rebuilt for it.
3. **Need rule for lax IDs.** Item 2's need rule now reads:
   - A **lax ID** has no copyleft terms and is either a plain permissive or public-domain grant, or a license the FSF calls GPL-compatible. A lax ID can join the permissive tier without a known entry that needs it.
   - A lax ID is out if the FSF recommends against it outright, as it does for WTFPL. A caveat about one kind of use doesn't count against it, such as CC0's "not for software, no patent grant" or Unicode-DFS-2016's "do not use for your own software". The report records each such caveat.
   - Every other ID still needs a known entry: copyleft IDs, and any `LicenseRef-*` ID, which also needs its own vendored text (027 item 1).
   - The rule says which IDs *may* join the permissive tier. Each addition still needs its own amendment, because a test pins the tier constants (027 item 1), and this amendment adds only the five in item 1.
   - `blessing` and `LicenseRef-PublicDomain` are public-domain grants and meet the definition, but they stay in the runtime tier. Moving them needs its own amendment.
4. **Still excluded.** Item 3's list becomes:
   - `Python-2.0`: it doesn't meet the lax definition. The FSF calls only 2.0.1 and later compatible and flags plain 2.0 as the intermediate version with a different license, so the ID doesn't map cleanly to a compatible FSF entry. It also isn't a plain grant.
   - `LGPL-3.0-or-later`.
   - `BlueOak-1.0.0`: a plain permissive grant with no FSF entry, so it meets the lax definition. The owner chose not to add it now. A later amendment can add it without a known entry.
   - `WTFPL`: the FSF recommends against it outright.
   - `CC-BY-4.0`: GPL-compatible with no copyleft terms, so it meets the lax definition. The FSF's "not for software" note is a use caveat. The owner chose not to add it now. A later amendment, for example for a bundled font or image, can add it without a known entry.
   - `Artistic-2.0`: it sets conditions on modified versions, so it isn't a lax ID. [Ticket 044](../tickets/044-artistic-2-domain-browser.md) settles it with an exception scoped to the `domain-browser@4.23.0` entry. This amendment doesn't widen that exception.
   - IDs that appear only as an `OR` branch that passes another way: `MPL-1.1`, `OpenSSL`, `Artistic-1.0-Perl`, `GPL-1.0-or-later`. `CC0-1.0` leaves this group because it is now in the permissive tier.
   - Every GPL-family and `-only` ID, and `AGPL-3.0-*`.
5. **License text.** Item 6 is unchanged. An entry under a new ID still needs its real text. Unlicense, CC0 and MIT-0 texts carry no copyright line, and that is acceptable because none of them requires a notice.
6. **Building it.** A new task ticket, "Add the lax IDs to the permissive tier and clear bun_clap's flag", blocked by this one, changes `PERMISSIVE_TIER` in `scripts/notices.ts` and its pinned test, and takes `MIT-0`, `BSL-1.0`, `Unlicense` and `CC0-1.0` out of the "excluded IDs fail in both tiers" test in `scripts/notices.test.ts` (`Unicode-DFS-2016` isn't in it). It moves the failing-example fixtures (`unlicense-pkg` and the runtime fixture's `odd-clap`) to an ID that is still excluded, such as `WTFPL`. It also clears `bun_clap`'s flag and note in `scripts/notices/bun-runtime.json` and updates the `bun-runtime.test.ts` blocked list. `bun run notices --check --strict` must then flag only the entries other tickets still hold.

## Rejected

- **Runtime tier only.** It was the main thread's recommendation. The owner put Unlicense in the permissive tier instead, on item 1's own logic that lax licenses go there (as Zlib and Unicode-3.0 do).
- **Replacing bun_clap.** Patching Bun from the owner's fork ties every pin bump to a custom build and changes the [LGPL relinking steps](./042-bun-lgpl-terms.md). Waiting for Bun to relicense blocks `v2.0.0-beta.1` with no date.
- **Unlicense only, or a one-off for four IDs.** The owner chose a general rule for lax IDs instead.
- **Dropping CC0, or keeping it as a named exception.** The owner narrowed the exclusion to outright recommendations against a license.
