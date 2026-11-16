# API package build and check: decision report

Ticket: [API package build and check](../tickets/012-api-package-build-and-check.md). Branch `t3/api-package-build-check`. The main thread implemented the ticket as a child of wayfinder-master. The council audited it in three rounds and approved (claude 8, gemini 10, gpt 10). The repo has no `workflow.md`, `AGENTS.md` or `CLAUDE.md` of its own, so the runner steps apply with the master's overrides: the commit gate commits without asking, the branch is pushed for the master to watch CI, and `map.md` is left alone.

## Build

**How `tsc` emits `.js` relative imports.** The options were `rewriteRelativeImportExtensions` with `.ts` specifiers in source, or `.js` specifiers written in source. I chose `.js` in source, as the spec says ("`.js` relative imports"). Bun and `tsc` both resolve `./schemas.js` to `schemas.ts`. Only `client.ts` needed the change. Decided by the implementer.

**Build config.** `api/tsconfig.build.json` extends `api/tsconfig.json` and turns on `declaration`, sets `outDir` to `dist` and `rootDir` to `src`, and sets `types` to `[]` so no declaration refers to Bun types. It excludes `*.test.ts`. `api/tsconfig.json` stays `noEmit`, so `bun run typecheck` still covers tests. The `build` script is `rm -rf dist && tsc -p tsconfig.build.json`. Decided by the implementer.

**`types.ts`.** It re-exports every public type from `./schemas.js` with `export type { ... }`. The compiled `dist/types.js` is empty, which meets "no runtime code". Decided by the implementer.

**`exports` and `files`.** Three subpaths (`./types`, `./schemas`, `./client`), each `{ types, default }` pointing into `dist/`, and `files` is `dist`, `README.md`, `LICENSE`. I first added `"./package.json"` to the map. Two seats flagged it against the dist-only rule, so I removed it. Decided by the implementer, changed after the council.

**README.** It covers the three subpaths, an OBS browser-source example with a CDN `<script type="module">` (spec §10), and a bundler example. `subscribe` and `validate` do not exist yet, so both examples use `get` helpers. Decided by the implementer.

## CI

**Job.** The `api-package` job lost its `if: false` and its comment now says what it does. Its steps (build, `bun pm pack`, `publint`, `attw --profile esm-only`) were already written by the skeleton ticket. The compiled-executable check with `api/dist` absent is the `compile-smoke` job's `test ! -e api/dist` step, so I added nothing for it. Decided by the implementer.

**Pinning.** `publint` 0.3.25 and `@arethetypeswrong/cli` 0.18.5 are exact root `devDependencies`, so `bunx` uses the locked copies. `bun.lock` changed by 128 added lines. Decided by the implementer.

**Local evidence.** `bun run build`, `bun pm pack`, `publint` ("All good!") and `attw --profile esm-only` (bundler and node16-from-ESM green) pass locally. `bun run lint`, `bun run typecheck` and the 11 `api/` tests pass. One root test fails only on this machine: `server/test/bridge/core.test.ts` expects Lua 5.4 and the local `lua` is 5.5. CI pins 5.4.

## Closed-enum test

**How to detect a change.** The options were a hand-written list of enum values, or a walker over the published schemas compared against a snapshot. I chose the walker. `api/src/schemas.test.ts` walks `resourceSchemas`, collects every `z.enum` by path, and compares the result with `api/src/__snapshots__/schemas.test.ts.snap`. A `z.enum` is closed by construction, and the open enums are plain `z.string()`, so they never appear. The walker throws on a schema node type it does not know, so a new enum cannot hide in a new node type. A comment tells readers not to refresh the snapshot to make the test pass. Decided by the implementer.

**Where the test lives.** The spec says "a server test". The package owns the schemas and the enums, so the test sits in `api/`, which the root `bun test` runs. Decided by the implementer.

**Exports test.** `api/src/package.test.ts` checks that the map has exactly the three subpaths, that every target matches `./dist/<name>.js` or `.d.ts`, and that `files` is the whitelist. Decided by the implementer.

## Audit

Round 1: claude 7 DISAPPROVE, gemini 9 APPROVE, gpt 6 DISAPPROVE.

| Problem | Seats | Outcome |
| --- | --- | --- |
| No green `api-package` CI run cited (blocking, claude) | claude | Rebutted. The job runs only after the push in step 6. Claude accepted this in round 2. |
| `./package.json` export breaks dist-only (blocking, gpt; minor, claude) | claude, gpt | Fixed. Removed from the map and from the test. |
| README says zod is needed only for `/schemas` | claude | Fixed. The README intro now says every declaration file imports Zod types. |
| Snapshot is generated from the code, so it does not check values against the spec | claude | Declined. The spec lists no values for §10 and only requires that a change fails the test. |

Round 2 (gpt and claude): gpt 10 APPROVE, claude 8 APPROVE. Claude's new minor items were the README placement (fixed by moving the note to the intro), the test checking path strings only (declined, publint and attw check existence in CI), the CDN URL not live before publish (declined, the package is unpublished) and a request to cite a re-run (cited). Round 3, a confirming round after the README move: claude 8, gemini 10, gpt 10. The remaining minor items were the pending CI run and the snapshot point above.

## Surfaced

**Zod-free declarations.** `dist/schemas.d.ts` imports `zod`, and `types.d.ts` and `client.d.ts` import from it. A project that installs neither `zod` nor sets `skipLibCheck` gets TS2307 on `/types` or `/client` (reproduced with a packed tarball in a clean directory). Spec §10 says users of types and the client never install Zod. Fixing this needs types that do not depend on Zod, such as hand-written interfaces kept in sync by a test, or a generated declaration file. That is a design choice, so it needs a grilling ticket. The README states the current limit.
