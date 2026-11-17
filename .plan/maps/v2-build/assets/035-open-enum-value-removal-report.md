# Decision report: May an open enum lose a value within `/api/v2`?

Ticket: [035](../tickets/035-open-enum-value-removal.md). Amendment: [035-open-enum-value-removal.md](./035-open-enum-value-removal.md). Grilling ticket, run in auto mode on 2026-11-16 (UTC). The main thread asked each question with a recommendation. A sonnet grilling subagent stood in for the owner and accepted every recommendation. The council approved in round 4.

## Grilling decisions

| # | Question | Options | Choice | By |
|---|---|---|---|---|
| Q1 | May an open enum lose, rename or redefine a name? | A append-only for all; B per-enum; C deprecate then remove | A | grilling subagent |
| Q2 | When does the rule bind? | A from stable release; B first prerelease; C first commit | A | grilling subagent |
| Q3 | Are rename aliases allowed? | A no; B yes | A | grilling subagent |
| Q4 | May the server stop emitting a listed name? | A per-enum (never topics, others only when the thing is gone); B never; C any time | A, plus "never reused" | grilling subagent |
| Q5 | Release rule for retiring | A app minor + package minor setting `retiredIn`; B app major; C app patch | A | grilling subagent |
| Q6 | Meaning records for every open enum? | A one record each, union derived, one test; B `modes` only | A, plus `invalid_topics` and `TOPICS` | grilling subagent |
| Q7 | Release rule for adding | A minor of app and package, fixture for `dataFormat`; B package-only adds | A | grilling subagent |
| Q8 | Where the test's baseline lives | A committed JSON rewritten at stable `api-v`; B read old tag or npm; C Bun snapshot | A, subset comparison | grilling subagent |
| Q9 | Who builds it | A new task ticket; B fold into 054; C each build ticket | A, plus a docs-coverage check | grilling subagent |
| Q10 | Anything missed? | none or name it | none | grilling subagent |

Main-thread additions: `battle.modes` follows item 4's retirement rule (retire a tag only when no readable battle can satisfy it).

## Audit

| Round | claude | gemini | gpt | Changes after the round |
|---|---|---|---|---|
| 1 | APPROVE 8 | APPROVE 8 | APPROVE 9 | Item 1 now separates removal from the known union from stopping emission. "(owner)" became "(owner stand-in)". Added a "Fixing meaning text" path. |
| 2 | APPROVE 8 | APPROVE 9 | APPROVE 9 | Baseline names the wording fix as its one other allowed edit. The `retiredIn` check allows unset-to-set. Clarified which side is wrong when a meaning and emission disagree. |
| 3 | DISAPPROVE 7 | APPROVE 10 | APPROVE 9 | Blocking: round 2 let a corrected meaning ship as a second name, against items 2 and 4. Removed. Also corrected an overstated claim about baseline regeneration. |
| 4 | APPROVE 8 | APPROVE 10 | APPROVE 9 | none |

Rebutted or declined minor problems:
- gemini r1: the report link didn't resolve. Rebutted, because the report is written after approval and committed with the amendment.
- claude r1: §7.2 "When" conditions were not checked as one-line meanings. Declined, because `spec.md:452-458` gives one short line per code, and error codes are not specific to a generation.
- claude r4: the subset check is justified with the wrong reason, since equality would also fail on a removal. Subset is needed so new names pass. Declined because the rule is right and only the explanation is loose.
- claude r4: a removal committed together with a baseline rewrite passes the test. Declined because the amendment already says the `RELEASING.md` step and review guard that case.

## Process notes

- Gates the runner skipped under its brief: the Jev audit (the parent ran it) and the user commit question (the brief says commit every time).
- I applied unslop's rules by hand instead of loading the skill, because the thread was near the 150k context limit.
- Surfaced: "Open-enum meaning records and append-only test" (task, unblocked).
