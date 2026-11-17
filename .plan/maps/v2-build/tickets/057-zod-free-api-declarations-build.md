---
type: task
blocked_by: [054]
claimed_by: wayfinder-master v2-build-master-1794843940
claimed_at: 2026-11-17T14:11:18Z
---

# Zod-free `/types` and `/client` declarations

## Question

Build what [How do `/types` and `/client` ship declarations that don't need Zod?](./054-zod-free-api-declarations.md) decided, per [amendment 054](../assets/054-zod-free-api-declarations.md). `/types` becomes hand-written types with a sync test that checks them equal to the Zod schemas, `/client` imports only those types, `zod` stays an optional peer, and CI typechecks the packed tarball in a project without `zod`. Later tickets that add a public schema, an SSE event or a `/client` signature are blocked by this one.

## Acceptance

- The built `types.d.ts` and `client.d.ts` import nothing from `zod` or `schemas`.
- The sync test fails when a hand-written type and its schema drift.
- A CI step packs `api/`, installs it in a clean project without `zod` and `skipLibCheck`, and typechecks imports of `/types` and `/client`.

## Answer

Built as [amendment 054](../assets/054-zod-free-api-declarations.md) specifies, in PR 39. The council approved in round 1 (claude 8, gemini 10, gpt 9) and all four CI checks passed. The decision report is [057-zod-free-api-declarations-build-report.md](../assets/057-zod-free-api-declarations-build-report.md).

- `api/src/types.ts` is hand-written and imports nothing. `schemas.ts` and `client.ts` take their types from it, and `zod` stays an optional peer.
- `api/src/sync.test.ts` checks each type equal to its schema's inferred type at compile time, checks `ResourceMap`, `Topic` and the enum tuples, fails at run time when an exported schema has no pair, and checks that `types.ts` and `client.ts` import neither `zod` nor `./schemas`.
- `scripts/api-consumer-smoke.ts` runs in the `api-package` CI job after `attw`. It installs the packed tarball outside the workspace, fails if `zod` is present, and typechecks `/types` and `/client` under `nodenext` and `bundler` with `skipLibCheck: false`.
- A new schema, SSE event or `/client` signature now needs a hand-written type, a sync pair and a name in `PAIRED` in `sync.test.ts`.

Why: plain types need no new tooling, and a clean consumer install is the only check that catches a `zod` import coming back. Declined: one minor audit note that `PAIRED` is a second name list beside the type pairs. No ticket surfaced.
