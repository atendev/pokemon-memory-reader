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
