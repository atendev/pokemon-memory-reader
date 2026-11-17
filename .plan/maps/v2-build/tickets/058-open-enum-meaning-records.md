---
type: task
blocked_by: [035, 057]
---

# Open-enum meaning records and append-only test

## Question

Build what [May an open enum lose a value within `/api/v2`?](./035-open-enum-value-removal.md) decided, per [its amendment](../assets/035-open-enum-value-removal.md): a meaning record for every value of every open enum in `/api/v2`, and an append-only test against the last stable baseline that fails when a value or its meaning disappears. It touches `api/src/types.ts`, so it follows [Zod-free `/types` and `/client` declarations](./057-zod-free-api-declarations-build.md).

## Acceptance

- Every open enum value has a meaning record, and a test fails on a value without one.
- Dropping or renaming a value, or changing a meaning, fails the append-only test.
