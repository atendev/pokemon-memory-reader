# Decision report: Does the runtime tier accept `Unlicense` for bun_clap, or is the dependency replaced?

Ticket: [043](../tickets/043-unlicense-bun-clap.md). Grilling ticket, interviewed with the owner on 2026-11-16 (UTC). Output: [amendment 043](./043-unlicense-bun-clap.md). `spec.md` isn't edited.

## Decisions

| # | Question | Options | Choice | Who | Audit |
|---|---|---|---|---|---|
| 1 | Accept `Unlicense` for `bun_clap`, or replace the dependency, and in which tier? | runtime tier only; permissive tier; keep out and patch Bun; keep out and wait for upstream | Permissive tier. The main thread recommended runtime tier only. | Owner | Approved |
| 2 | Add the other IDs 027 left out for lack of need? | `Unlicense` only; also `CC0-1.0`; `Unlicense`, `CC0-1.0`, `MIT-0` and `BSL-1.0` together | All four. The main thread recommended `Unlicense` only. | Owner | Approved |
| 3 | Who builds the code change? | a new task ticket; this ticket | A new task ticket blocked by this one | Owner, as recommended | Approved |
| 4 | How does 027 item 2's need rule read now? | general rule for lax IDs plus `Unicode-DFS-2016`; general rule with no more IDs; a one-off for four IDs | General rule, and `Unicode-DFS-2016` is added now. `Python-2.0`, `WTFPL`, `BlueOak-1.0.0` and `CC-BY-4.0` stay out. | Owner, as recommended | Approved |
| 5 | Does `CC0-1.0` survive the rule, given the FSF doesn't recommend it for software? | exclude only on an outright FSF recommendation against; CC0 as a named exception; drop CC0 | Outright only. Use caveats are recorded but don't exclude. | Owner, as recommended | Approved |
| 6 | Is `Artistic-2.0` a lax ID? | n/a | No. The owner noted at confirmation that ticket 044 settles it with an exception scoped to `domain-browser@4.23.0`. | Owner | Approved |
| 7 | Do `CC-BY-4.0` and `BlueOak-1.0.0` meet the new definition? | excluded on the old grounds; lax but not added now | Lax but not added now. They stay out by the owner's choice in question 4, and a later amendment needs no known entry. | Main thread, after audit round 1 | Approved |
| 8 | Do `blessing` and `LicenseRef-PublicDomain` move to the permissive tier? | move them; stay in the runtime tier | They stay. Moving them needs its own amendment. | Main thread, after audit round 1 | Approved |

## Facts checked

- The `bun_clap` entry and its Unlicense text are in the checked-in manifest from ticket 041. The binary carries it for all six targets.
- FSF license list, read 2026-11-16 by a web-fetch subagent: Unlicense, Boost, the Unicode data-files license and MIT-0 (as "Expat No Attribution") are GPL-compatible. The FSF advises against CC0 for software and recommends against WTFPL outright. The CC0 wording came from a summary of the page's tail, not a verbatim quote.
- The five IDs weren't checked against the installed `spdx-license-ids`, because `node_modules` isn't installed in this worktree. The build ticket's tests will catch a bad ID.

## Audit

One haiku auditor ran on the amendment.
- Round 1: six problems. `CC-BY-4.0` and `BlueOak-1.0.0` were excluded on grounds the new rule no longer accepts. The carve-out caught `blessing` and `LicenseRef-PublicDomain`. The test edit didn't name its IDs, the build ticket wasn't named, and some facts had no source. All six were fixed.
- Round 2: APPROVE. Non-blocking notes: the auditor could not verify the 027 research wording, the notices test contents or the tag SHA, because its brief limited it to the amendment file.

## Surfaced

- "Add the lax IDs to the permissive tier and clear bun_clap's flag", a task ticket blocked by this one.

## Left for the owner

- The runtime tier gains the five IDs only because it includes the permissive tier. Once the build ticket lands, `v2.0.0-beta.1` still waits on 044, on 046 with the MIT reading, and on 047 to 050.
