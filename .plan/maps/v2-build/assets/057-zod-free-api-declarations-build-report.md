# Report: Zod-free `/types` and `/client` declarations

Ticket: [Zod-free `/types` and `/client` declarations](../tickets/057-zod-free-api-declarations-build.md). It builds [amendment 054](./054-zod-free-api-declarations.md). No grilling ran, because the amendment settled the design. The council approved in round 1 (claude 8, gemini 10, gpt 9).

## What changed

- `api/src/types.ts` now holds hand-written types and imports nothing. Every loose object level, nested ones included, carries `[key: string]: unknown`. Enum unions are literal unions. Nested objects stay inline.
- `api/src/schemas.ts` imports each type from `types.ts` under an alias and re-exports it under the schema's name, so server and test imports do not change. `TYPES`, `NATURES`, `STATUSES` and `TOPICS` are `as const satisfies readonly <Union>[]`.
- `api/src/client.ts` imports its types from `types.ts`.
- `api/src/sync.test.ts` is new. It holds the type-level equality pairs, the mapped checks, a runtime test that every exported Zod schema has a pair, and a test that `types.ts` and `client.ts` import nothing from `zod` or `./schemas`.
- `scripts/api-consumer-smoke.ts` is new. It installs the packed tarball in a temp directory outside the workspace, fails if `node_modules/zod` exists, and typechecks `/types` and `/client` under `nodenext` and `bundler` with `strict` and `skipLibCheck: false`.
- `ci.yml` runs the smoke script in the `api-package` job after `attw`.
- The README note that every declaration imports Zod is gone, and the `/types` line describes the new contract.

## Decisions

**D1. Where the smoke check lives.** Options: inline shell in `ci.yml`, or a Bun script under `scripts/`. Chosen: a script, so the logic can be run locally and `ci.yml` gets one line. Made by the implementer. The amendment only fixes the behaviour, not the form.

**D2. Where the type-level pairs live.** Options: a separate `.d.ts`-style check file, or inside a `bun test` file. Chosen: `api/src/sync.test.ts`. `tsc --noEmit` covers test files through `api/tsconfig.json`, so `bun run typecheck` checks the pairs, and the runtime test sits beside them. Made by the implementer.

**D3. Equality helper.** Options: mutual assignability, or the strict `Equal` form that compares through a generic conditional type. Chosen: strict `Equal`. Mutual assignability accepts a missing index signature in one direction, which the amendment says the test must catch. Made by the implementer.

**D4. Consumer file content.** Options: a bare import, or a file that uses `getStatus`, `getParty`, `ClientOptions`, `ErrorBody`, `Pokemon`, `ResourceMap` and `Topic`. Chosen: the second, so a bad type in an exported signature fails and not just a bad import. Made by the implementer.

## Evidence

- `bun run typecheck` passes in all workspaces. `biome ci` is clean.
- `bun test` gives 492 passes and one failure, the Lua 5.3 test, because this machine has no `lua5.3` binary. It is unrelated to the diff.
- `publint` reports "All good". `attw --profile esm-only` is green.
- The built `dist/types.d.ts` and `dist/client.d.ts` mention `zod` and `schemas` only in one comment in `types.d.ts`. Neither imports them.
- Drift mutations fail `bun run typecheck`: `ppUps: number` changed to `string`, and an extra member added to `Type`.
- A regression mutation, `client.ts` importing `./schemas.js`, fails the smoke script with TS2307 on `zod`.

## Audit

Round 1: claude APPROVE 8, gemini APPROVE 10, gpt APPROVE 9. No blocking problem. The gate opened with no fix round.

| Problem | Raised by | Status |
| --- | --- | --- |
| `PAIRED` in `sync.test.ts` is a second name list, so a name can sit in `PAIRED` with no matching `Expect<Equal<...>>` line and still pass `bun test`. | claude, minor | Declined. One seat raised it, and a missing pair line for a schema already listed is a reviewer-visible edit in one 13-line block. The runtime test still fails when a schema is missing from `PAIRED`. |
| The smoke script's TypeScript version is not pinned if the root devDependency is a range. | claude, minor | Rebutted. The root `package.json` pins `"typescript": "7.0.2"` exactly. |

## Left for later tickets

Per amendment 054 §7, tickets that add a public schema, an SSE event or a `/client` signature now follow §1 to §4: a hand-written type, a sync pair and a line in `PAIRED`. No new ticket surfaced.
