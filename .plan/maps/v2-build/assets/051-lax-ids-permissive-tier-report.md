# Decision report: Add the lax IDs to the permissive tier and clear bun_clap's flag

Ticket: [051](../tickets/051-lax-ids-permissive-tier.md). Task ticket, run as a child of wayfinder-master on 2026-11-16 (UTC). It builds item 6 of [amendment 043](./043-unlicense-bun-clap.md). No grilling or research ran.

## What changed

- `scripts/notices.ts`: `PERMISSIVE_TIER` gains `Unlicense`, `CC0-1.0`, `MIT-0`, `BSL-1.0` and `Unicode-DFS-2016`, in that order, after `Unicode-3.0`. `RUNTIME_TIER` spreads the permissive tier, so it gains them too.
- `scripts/notices.test.ts`: the tier test pins all thirteen IDs. The first four new IDs leave the "excluded IDs fail in both tiers" test. A new test checks all five in both tiers. A new `lax` npm fixture (one package per ID) passes with no problems.
- Failing examples moved to `WTFPL`: the npm fixture `unlicense-pkg` in `disallowed` is now `wtfpl-pkg`, and the runtime fixture's `odd-clap` keeps its name with `spdx: "WTFPL"`.
- `scripts/notices/bun-runtime.json`: `bun_clap` loses `blockedUntilAmendment`, and its note now says the permissive tier accepts the Unlicense.
- `bun-runtime.test.ts` and the repo-level tests now expect only `domain-browser` as blocked.

## Evidence

- `bun test scripts`: 133 pass, 0 fail.
- `bun run typecheck` and `bun run lint`: clean.
- `bun run notices --check --strict`: fails with one problem, `domain-browser@4.23.0` is blocked. That entry belongs to [ticket 052](../tickets/052-runtime-entry-exception-domain-browser.md). `bun_clap` passes.

## Decisions

| # | Question | Options | Choice | Made by | Audit |
| --- | --- | --- | --- | --- | --- |
| 1 | Where do the passing lax fixtures go? | Rename `unlicense-pkg` in place and add four packages to `allowed`; or a new `lax` fixture dir | New `lax` dir with five packages. The `allowed` tests pin an entry list and hashes, so adding packages there would churn unrelated tests | Implementer | Approved in round 1 |
| 2 | Should the runtime fixture also carry a passing lax entry? | Add a `lax-clap` entry; or rely on the repo's real `bun_clap` | Rely on `bun_clap`. A `lax-clap` entry broke the entry-list and missing-text counts, and the repo test already runs the real Unlicense entry through the runtime tier. I tried it and reverted it | Implementer | Approved in round 1 |
| 3 | What to call the moved failing fixture? | Keep `unlicense-pkg` with a WTFPL license; or rename to `wtfpl-pkg` | Rename to `wtfpl-pkg`, so no fixture's name contradicts its license | Implementer | Approved in round 1 |
| 4 | Order of the new IDs in the tier constant | Alphabetical; or amendment order | Amendment 043 item 1 order | Implementer | Approved in round 1 |

## Audit

Council round 1: `COUNCIL APPROVE | round 1 | claude 8 | gemini 10 | gpt 10`. No blocking problems.

Declined or rebutted minor problems, both from the claude seat only:

- The `lax` fixture only exercises the npm (permissive) path, so "fixtures pass in both tiers" is shown partly by the `checkExpression` unit test. Declined. The real `bun_clap@1.4.2` entry runs through the runtime tier in the repo test, and the unit test covers all five IDs in both tiers.
- `wtfpl-pkg/LICENSE` still holds the old text. Rebutted. The file holds the MIT fixture text, not Unlicense text, and the disallowed check fails on the license field first.

## Left for other tickets

- `domain-browser` stays flagged until [ticket 052](../tickets/052-runtime-entry-exception-domain-browser.md) lands. `--check --strict` flags only that entry until then.
- `bun install --frozen-lockfile` was needed in the worktree to run the tests. No lockfile change.
