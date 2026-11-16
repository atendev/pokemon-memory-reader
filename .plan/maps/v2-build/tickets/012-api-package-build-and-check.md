---
type: task
blocked_by: [004, 015]
claimed_by: wayfinder-master v2-build-master-1794843940
claimed_at: 2026-11-16T16:05:32Z
---

# API package build and check

## Question

Build the `api/` package and turn on the CI check that Workspace skeleton and CI left as an `if: false` job. That covers the dist `exports` map, the `api/` build, `files`, `types.ts` and `schemas.ts`, as spec §10 and the Importable package decision describe. A source-path `exports` map would break that decision.

## Acceptance

- `api/` builds to dist, and its `exports` map points only at built files.
- The API package check job in `ci.yml` runs and passes.
- The closed-enum test from spec §10 is in place.
