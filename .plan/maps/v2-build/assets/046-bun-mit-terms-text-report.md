# Add the MIT terms text to Bun's manifest entry: decision report

Builds the follow-up in [the 045 amendment](./045-bun-license-text.md). Ticket: [046](../tickets/046-bun-mit-terms-text.md).

## What changed

- `scripts/notices/texts/bun_1.4.2__MIT-terms.txt` is new. It holds the two-line header from amendment 045 decision 3, a blank line, then lines 5 to 18 of `text/MIT.txt` from `spdx/license-list-data` tag `v3.29.0`. The body's SHA-256 is `83330a27667f812efa9c7cdaefd4c83f95b57a7454323a61ee29291312640468`, which matches the amendment. I fetched the template from the tag with `gh api` and hashed it before writing the file.
- The `bun` entry in `scripts/notices/bun-runtime.json` now lists `bun_1.4.2__LICENSE.md.txt` then `bun_1.4.2__MIT-terms.txt`. Its `notes` field now says what the terms file is and what each pin bump's review does (decision 6).
- `scripts/notices/bun-runtime.test.ts` gains three cases:
  - Only the `bun` entry carries a file ending `__MIT-terms.txt`, its `spdx` is exactly `MIT`, and its `texts` are the two files in that order.
  - Bun's `LICENSE.md` text matches a pinned SHA-256.
  - The terms file has the exact header, a blank third line, a final newline and a body with the pinned SHA-256.

## Decisions

| Question | Options | Choice | Made by | Audit |
| --- | --- | --- | --- | --- |
| How does the test show `LICENSE.md` was not changed? Acceptance says "either is missing or changed". | Check the file only exists (the old test already does); compare to upstream at run time; pin the SHA-256 of the vendored file | Pin the SHA-256 of the vendored file, `51402e15…6ba4f` | Implementer | APPROVE, round 1 |
| How does the terms test split header and body? | Hash the whole file; hash the body after the header and blank line | Check the header lines exactly, then hash the body, as decision 5 says | Implementer | APPROVE, round 1 |
| Should the `LICENSE.md` copy lose its final newline so it is truly byte for byte upstream? | Strip the newline; leave 041's file alone | Left alone, and flagged below | Implementer | APPROVE, round 1 |

## Findings

- Bun's `LICENSE.md` at `bun-v1.4.2` has no final newline (5613 bytes). The vendored copy from ticket 041 has one (5614 bytes). Nothing else differs. Amendment 045 says "unchanged" and "byte for byte", so strictly the copy is one byte off. The pinned hash covers the file as vendored. If the owner wants the upstream bytes exactly, strip the newline and update the hash in the test. The auditor made the same point. The newline is harmless to any renderer, so I left it alone.
- The manifest schema and `scripts/notices.ts` did not change. `bun run notices --check` still passes and warns only on the two `blockedUntilAmendment` entries.
- The owner still has to confirm the MIT notice reading before `v2.0.0-beta.1` (amendment 045 decision 3). This ticket does not settle that.

## Verification

- `bun test scripts`: 131 pass, 0 fail. `biome ci scripts` and `bun run typecheck` pass. `bun run notices --check` passes.
- Mutation checks. Changing one word in the terms file fails the terms case. Appending a byte to `LICENSE.md` fails the `LICENSE.md` case. Deleting the terms file fails the terms case and the existing "texts exist" case.
