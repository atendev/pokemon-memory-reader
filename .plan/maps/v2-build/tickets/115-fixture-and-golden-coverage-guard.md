---
type: task
blocked_by: [092]
---

# Coverage guard for fixtures and goldens

## What to build

Surfaced by [`SliceAdapter`, fixture files and golden files](./091-slice-adapter-and-fixtures.md). Add a guard that fails on a draft golden, keeps ROM-dependent nulls off `verified`, and caps the size of files under `fixtures/`. It builds on the golden format from 091 and the capture tool.

## Acceptance criteria

- A draft golden fails the guard.
- A ROM-dependent null on `verified` fails the guard.
- An oversized fixture fails with a readable message.
