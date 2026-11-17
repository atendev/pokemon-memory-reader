---
type: task
blocked_by: [035, 057]
claimed_by: wayfinder-master v2-build-master-1794938032
claimed_at: 2026-11-17T17:54:38Z
---

# Open-enum meaning records and append-only test

## Question

Build what [May an open enum lose a value within `/api/v2`?](./035-open-enum-value-removal.md) decided, per [its amendment](../assets/035-open-enum-value-removal.md): a meaning record for every value of every open enum in `/api/v2`, and an append-only test against the last stable baseline that fails when a value or its meaning disappears. It touches `api/src/types.ts`, so it follows [Zod-free `/types` and `/client` declarations](./057-zod-free-api-declarations-build.md).

## Acceptance

- Every open enum value has a meaning record, and a test fails on a value without one.
- Dropping or renaming a value, or changing a meaning, fails the append-only test.

## Answer

Built as [amendment 035](../assets/035-open-enum-value-removal.md) specifies, in PR 42. The council approved in round 2 (claude 8, gemini 10, gpt 9) and all four CI checks passed. The decision report is [058-open-enum-meaning-records-report.md](../assets/058-open-enum-meaning-records-report.md).

- `api/src/meanings.ts` holds one meaning record per open enum (error code, data format, adapter id, bridge name, adapter problem, topic). `types.ts` derives the known unions from the record keys and exports open types (`ErrorCode` and the others, each known union plus `(string & {})`). `Topic` stays the closed known union. The schemas validate those fields as strings.
- `api/src/open-enums.test.ts` checks each entry has a one-line meaning, unit-tests the append-only check on synthetic baselines (removal, rename, meaning edit, `retiredIn` change fail), runs it against `api/open-enums.baseline.json` and skips with a warning until `api-v2.0.0` adds that file, and checks that the docs list equals the records and the docs block equals the render.
- `docs/open-enums.md` is the contract docs page. `bun api/scripts/open-enums.ts baseline` writes the baseline and `docs` rewrites the rendered block.
- `server/test/api/open-enums.test.ts` checks every error code, adapter id, problem, bridge name, topic and data format the server emits has a record.
- A new open enum needs a record, a docs bullet and a name in `OPEN_ENUMS`. `battle.modes` joins when `battle` lands.

Why: records in an import-free file keep `/types` free of `zod`, and a pure comparison function lets the failing cases run now, before a baseline exists. Declined: six single-seat minor notes, listed in the report. Surfaced: move the baseline step from `docs/open-enums.md` into `RELEASING.md` once that file exists.

Timing: wall 10m, active 7m, user 0s, wait 2m, blocked 0s | implement 3m, audit 2m (1 round), fix 1m, ci 2m | tools 61 (9 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 141k | cost $2.14 sonnet-5-5 + $0.02 haiku-5-5
