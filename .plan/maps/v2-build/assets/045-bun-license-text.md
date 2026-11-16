# Bun's own license text: amendment for spec §13.5

Resolves [Is Bun's own `LICENSE.md` enough as its MIT text?](../tickets/045-bun-license-text.md). It adds an exception to item 6 and a check to item 7 of the [027 amendment](./027-third-party-license-allowlist.md), and changes the `bun` entry that [the 041 manifest](./041-bun-runtime-notices-manifest-report.md) shipped.

These were decided in auto mode on 2026-11-16 (UTC). The main thread asked each question with a recommendation, and a grilling subagent answered.

## Facts

Checked at Bun tag `bun-v1.4.2`, which `gh api repos/oven-sh/bun/git/ref/tags/bun-v1.4.2` resolves to commit `744846f844374847c902b5e7fd59b4342a51ef99`:

- The only top-level license file is `LICENSE.md`. It opens with "Bun itself is MIT-licensed." and goes on to JavaScriptCore's LGPL relinking steps and a table of linked libraries. It has no copyright line and no MIT permission text. `docs/project/license.mdx` repeats the same wording.
- The tree's other license-named files belong to sub-components: `packages/bun-usockets/LICENSE` and `packages/bun-uws/LICENSE` (both Apache-2.0 text) and `src/clap/LICENSE` (the `bun_clap` entry, `Unlicense`, held by [ticket 043](../tickets/043-unlicense-bun-clap.md)). `packages/bun-vscode/LICENSE` is an empty file.
- `README.md` has no copyright line. Its License section links to the docs page above. The root `package.json` has no `license`, `author` or copyright field.
- The npm packages `bun@1.4.2` and `bun-types@1.4.2` declare `"license": "MIT"`, have no `author` field and contain no license file.
- GitHub's license detection for `oven-sh/bun` reports `NOASSERTION`.
- The local Bun 1.4.2 `linux-x64` binary holds 27 "copyright" strings, and none of them names Oven, Jarred Sumner or Bun.

What was checked: license-named files across the tag's tree, the README, the root `package.json`, the docs license page, both npm tarballs, GitHub's license detection and one target's binary strings. Source-file headers were not searched one by one. In these places no copyright holder for Bun appears, and `LICENSE.md` is the only notice found. It names the MIT license but doesn't state its terms. If a later check finds a real copyright line, decision 6's switch applies at once rather than waiting for a pin bump.

## Decisions

1. **What the `bun` entry ships.** Two texts, in this order:
   - `texts/bun_1.4.2__LICENSE.md.txt`: Bun's `LICENSE.md`, unchanged, as the 041 manifest already has it.
   - `texts/bun_1.4.2__MIT-terms.txt`: the MIT terms that `LICENSE.md` names, with no copyright line.

   Rejected: `LICENSE.md` alone, because it leaves "MIT" as a bare name with no terms, the gap item 6's "real license text" rule exists to close. An MIT text with a holder we fill in ("Oven, Inc.", "Jarred Sumner") was also rejected, because no artifact names a holder and this project won't invent one. Holding `v2.0.0-beta.1` until upstream publishes a full text was rejected because that would block on a third party with no timeline.

2. **`LICENSE.md` stays as is.** It is shipped byte for byte, including its library table and its LGPL relinking steps. The 041 report notes one row with no manifest entry, Tigerbeetle's Windows IO code. No path in the 1.4.2 tree contains "tigerbeetle", and whether the binary carries that code is a manifest completeness question for the 041 review, not for this ticket. Editing a licensor's notice is worse than carrying stale lines. The manifest's own entries say what the binary contains. LGPL compliance stays with [ticket 042](../tickets/042-bun-lgpl-terms.md).

3. **The terms file's content.** A bracketed two-line header, a blank line, then lines 5 to 18 of `text/MIT.txt` from `spdx/license-list-data` tag `v3.29.0`, word for word and ending in a newline. Those lines are the permission paragraph, the "The above copyright notice and this permission notice shall be included..." sentence and the warranty paragraph. Their SHA-256 is `83330a27667f812efa9c7cdaefd4c83f95b57a7454323a61ee29291312640468`. The template's "MIT License" title and its `Copyright (c) <year> <copyright holders>` line are left out. The header reads:

   ```
   [MIT License terms named by Bun's LICENSE.md. That file gives no
   copyright line, so none is given here.]
   ```

   The "above copyright notice" sentence stays so that the file is the standard MIT text word for word, not a reworded variant. For Bun, the project reads that condition as met by shipping `LICENSE.md`, the only notice found in the places listed under Facts, together with these terms. No legal source has confirmed this reading. The auto-mode grilling subagent accepted this risk for the owner. The owner hasn't confirmed it yet and does so before `v2.0.0-beta.1` ships. The header says plainly that no copyright line is given.

4. **Exception to item 6.** Item 6's rule against canonical SPDX texts still stands. There is one named exception: a canonical text may be added as a second text, never in place of upstream's own text, when upstream ships a notice that names the license but gives no copyright line or terms. Today the exception covers only the `bun` entry and the MIT terms. Extending it to another entry needs an amendment that cites this one.

5. **How it is marked and enforced.** The manifest schema doesn't change. The terms file is appended to the `bun` entry's `texts` after `LICENSE.md`, so any renderer that prints `texts` prints it. A case in `scripts/notices/bun-runtime.test.ts` keeps the exception narrow:
   - only the `bun` entry carries a file whose name ends in `__MIT-terms.txt`,
   - that entry's `spdx` is exactly `MIT`,
   - an upstream text comes before the terms file in `texts`,
   - the terms file's body after the header and blank line has the SHA-256 above, and so matches the pinned template lines.

   [Third-party notices script and CI check](../tickets/040-third-party-notices-script.md) needs nothing new for this.

6. **Pin bumps (item 7).** Each Bun pin bump's completeness review also checks whether upstream now ships a full MIT text with a copyright line. If it does, the `bun` entry switches to that text and drops the terms file, and the test case in decision 5 is removed. If not, the terms file carries over under the new version's file name. The `bun` entry's `notes` field says this.

7. **Upstream.** The project files no issue on `oven-sh/bun` within this map. It is an outward-facing step and the decision doesn't depend on it. Asking upstream to publish a full MIT text with a copyright holder is an optional owner action.

## Spec text to change

- §13.5: cite this amendment next to amendment 027 for the license-text rule (decision 4) and the Bun pin-bump review (decision 6).

## Follow-ups

- **Add the MIT terms text to Bun's manifest entry** (task, no blockers): add `scripts/notices/texts/bun_1.4.2__MIT-terms.txt` per decision 3, append it to the `bun` entry's `texts`, update the entry's `notes` per decision 6, and add the test case from decision 5. If a later check finds a real Bun copyright line before this lands, use that text and skip the terms file. This task is not filed or numbered yet. Once it is, `v2.0.0-beta.1` waits on it rather than on 045.
