# Decision report: Does the runtime tier accept `Artistic-2.0` for domain-browser?

Ticket: [044](../tickets/044-artistic-2-domain-browser.md). Grilling ticket, run as a child of wayfinder-master on 2026-11-16 (UTC). The owner answered in this thread. The master relayed and confirmed the answers when the question tool aborted. The result is [amendment 044](./027-third-party-license-allowlist.md#amendment-044-artistic-20-for-buns-domain-browser), a section of its own in the 027 asset.

## Research

Two sonnet subagents ran under the runner's research limits, each on one sub-question:

- [Bun embedding](./044-research-bun-domain-browser.md) (21 calls). Bun 1.4.2 bundles and minifies `domain-browser@4.23.0` without editing it and embeds it in non-debug builds. Only the browser-target bundler path reaches it. Bun 1.4.4 and main still pin it. 4.22.0 was the last MIT release.
- [Artistic-2.0 terms](./044-research-artistic-2-terms.md) (18 calls). The FSF calls it GPL-compatible, through a Modified Version relicensing clause. §5 lets an unmodified Compiled copy ship with instructions for getting the Source. §7 allows aggregation with no licensing fee, and §8 allows embedding with no direct interface to the Package.

## Decisions

| # | Question | Options | Choice | Made by | Audit |
|---|---|---|---|---|---|
| 1 | What does amendment 027 do with `Artistic-2.0`? | Add to the runtime tier (recommended); entry-scoped exception; keep it out and patch Bun; keep it out and wait for Bun to pin MIT 4.22.0 | Entry-scoped exception | Owner | Approved |
| 2 | What is the exception keyed on? | Exact `name@version` plus ID (recommended); package name plus ID | Exact `name@version` plus ID | Owner | Approved |
| 3 | Where does the exception live? | A constant in `scripts/notices.ts` (recommended); a field in `bun-runtime.json` | `RUNTIME_ENTRY_EXCEPTIONS` constant, pinned by a test, Bun manifest entries only | Owner | Approved |
| 4 | How do releases meet Artistic-2.0 §5? | Tarball URL plus online check (recommended); tarball URL only; attach the tarball to each release | Tarball URL plus online check | Owner | Approved |
| 5 | Is `Artistic-2.0` lax under the sibling `Unlicense` rule? | Lax; not lax | Not lax. Its conditions go beyond keeping notices (§4, §5, §6, §7), the same ground that keeps LGPL and MPL out. The rule's parenthetical is read as the qualification test, not the definition of lax | Main thread, after the master's context note | Approved in round 3 |
| 6 | Is Bun's bundled, rewritten copy still the Standard Version? | Standard Version; Modified Version | Standard Version. The generic bundling and rewrite are mechanical transformation into a Compiled form. A Bun change aimed at domain-browser reopens this | Main thread | Approved after round 2 |
| 7 | Does a stale exception fail CI? | Fail; ignore | Fail, like a stale override (027 item 8) | Main thread | Approved |
| 8 | Where does the online source-URL check get built? | In the exception task; in its own task after 049 | Its own task, blocked by the exception task and by ticket 049, which builds the online check | Main thread | Approved |
| 9 | Bun's vendored `LICENSE.md` lists domain-browser as MIT. What do the notices show? | Edit Bun's text; record it only in the manifest `notes`, which aren't printed; print a note from the exception | Each exception item carries a `note` that the notices file prints under the entry's `Source:` line. Bun's text stays byte for byte (amendment 045) | Main thread, from the auditor's round 2 | Approved in round 3 |

## Audit

Haiku auditor, one agent for every round.

- Round 1: seven problems. Item 2's lax argument didn't match the sibling rule as worded. Item 1 gave no reason. The Bun build's string rewrite was left out of the Standard Version claim. The per-target and runtime-reach facts overstated the research. §8 was assumed without a repo check. The notices `Source:` line wasn't cited. The FSF verdict was used without its Modified-Version caveat. All seven were fixed. The definition of lax is now stated, the repo was checked for `Bun.build` browser calls, `scripts/notices.ts` lines 548 and 601 are cited, and the facts are restated.
- Round 2: one blocking problem, Bun's MIT row for domain-browser, fixed by decision 9. One citation fix: the repo check now names its scope (all files in `server/`, `viewer/`, `scripts/` and `api/`). One conditional point: item 2's reading of the sibling lax rule holds only if the sibling's wording allows it, and it is left for the master to confirm at merge.
- Round 3: APPROVE. Two wording notes were applied afterwards. Item 2 now calls its reading of the sibling rule unconfirmed, and the Facts and the printed note say the Bun MIT row appears to predate 4.23.0 instead of stating which versions it describes.

## Skipped gates

- The runner's commit gate question was skipped, per the master brief (commit every time).
- The grilling skill's final shared-understanding confirmation was skipped under the runner's confirmation override. The owner answered every frontier question, and the master confirmed the answers.

## For the master

- The sibling `Unlicense` amendment's wording of the lax rule should be checked against item 2's reading when the two sections merge.
- Two follow-up tasks are listed at the end of the amendment.
