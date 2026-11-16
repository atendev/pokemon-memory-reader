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

## Answer

`api/` builds with `bun run build` (`tsc -p tsconfig.build.json`) into `dist/`, with `.js` relative imports, ES2022 output and declarations. The `exports` map has exactly `./types`, `./schemas` and `./client`, each pointing at built files, and `files` is `dist`, `README.md` and `LICENSE`. `types.ts` re-exports the public types and compiles to an empty module. The README has the OBS and CDN examples, using `get` helpers because `subscribe` is not built yet. `publint` 0.3.25 and `@arethetypeswrong/cli` 0.18.5 are pinned at the root, and the `api-package` job runs unconditionally. It passes with the other three jobs on 42a20b5 (PR 35). `api/src/schemas.test.ts` walks every published schema, snapshots each `z.enum` by path, and throws on an unknown schema node type. `api/src/package.test.ts` pins the exports map and `files`. The council approved in round 3 (claude 8, gemini 10, gpt 10). [Report](../assets/012-api-package-build-and-check-report.md).

- The declaration files import Zod types, so `/types` and `/client` users without `zod` need `skipLibCheck`, against spec §10. The README states it. Fixing it is a design choice, raised as a grilling ticket.
