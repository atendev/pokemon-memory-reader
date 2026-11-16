# Decision report: Is Bun's own `LICENSE.md` enough as its MIT text?

Ticket: [045](../tickets/045-bun-license-text.md). Amendment: [045-bun-license-text](./045-bun-license-text.md). Run in auto mode on 2026-11-16. The main thread asked each question with a recommendation, a sonnet grilling subagent answered for the owner, and a haiku auditor checked the amendment.

## Facts gathered (main thread)

Bun 1.4.2 has no full MIT text and names no copyright holder in any place checked. Those places were license-named files in the `bun-v1.4.2` tree, `README.md`, the root `package.json`, `docs/project/license.mdx`, the `bun` and `bun-types` npm tarballs, GitHub's license detection (`NOASSERTION`) and the strings of the local linux-x64 binary. `LICENSE.md` says only "Bun itself is MIT-licensed." The SPDX `MIT` template was pinned at `spdx/license-list-data` v3.29.0.

## Decisions

| # | Question | Options | Choice | Made by | Audit |
|---|----------|---------|--------|---------|-------|
| 1 | What text does the `bun` entry ship? | LICENSE.md alone; LICENSE.md plus MIT with a holder we fill in; LICENSE.md plus the MIT terms with no copyright line; block beta.1 on upstream | LICENSE.md plus the MIT terms with no copyright line | Grilling subagent, accepting the main thread's recommendation | Approved in round 3 |
| 2 | Is LICENSE.md edited? | Unedited; trimmed to its first line | Unedited, byte for byte | Grilling subagent (recommendation) | Round 1 objected to an unevidenced Tigerbeetle claim, which now cites the 041 report and the tree search |
| 3 | What happens at a Bun pin bump? | Re-check for an upstream MIT text and switch if one appears; nothing special | Re-check and switch, recorded in `notes` | Grilling subagent (recommendation) | Approved in round 3 |
| 4 | Ask upstream for a full MIT text? | No action, optional for the owner; open an issue | No action, optional for the owner | Grilling subagent (recommendation) | Approved in round 3 |
| 5 | What goes in the terms file? | Template lines 5 to 18 word for word under our header; the same without the "above copyright notice" sentence | Lines 5 to 18 word for word | Grilling subagent (recommendation) | Round 1 objected to an unsourced legal claim. Round 2 asked that the risk not read as owner-accepted. The amendment now says the grilling subagent accepted it for the owner, pending the owner's confirmation |
| 6 | How is the exception marked? | No schema change, with a test in `bun-runtime.test.ts`; a new `canonicalTerms` field | No schema change, with the test | Grilling subagent (recommendation) | Approved in round 3 |
| 7 | Who builds it? | A surfaced task ticket; this ticket | A surfaced task ticket | Grilling subagent (recommendation) | Round 1 flagged a circular blocker line, now fixed |
| 8 | How strong is the "no copyright holder" claim? | As first written ("no artifact"); narrowed to the places checked | Narrowed, with the terms-file header speaking only about LICENSE.md | Main thread, after audit round 1 | Approved in round 3 |

## Audit

Round 1 returned five problems: an overclaim about the copyright holder, the Tigerbeetle claim, an unchecked commit SHA and bun-uws license, the legal premise behind keeping the template sentence, and a circular blocker line. The main thread gathered the missing evidence and revised the amendment. Round 2 found four objections resolved and two wording points open: the risk read as already accepted by the owner, and "the only notice" was unscoped in two places. The main thread fixed both. Round 3 returned `APPROVE`.

## Skipped gates

The runner's step 5 commit question to the user was skipped, because the master's brief says to commit every time. Grilling ran in auto mode with no interview of the owner.

## Left for the owner

- Confirm before `v2.0.0-beta.1` that shipping `LICENSE.md` with the MIT terms meets MIT's notice condition. The grilling subagent accepted this risk for you, and no legal source has confirmed it.
- Optionally, ask `oven-sh/bun` to publish a full MIT text with a copyright holder.

## Surfaced

- Add the MIT terms text to Bun's manifest entry (task, no blockers). `v2.0.0-beta.1` waits on it.
