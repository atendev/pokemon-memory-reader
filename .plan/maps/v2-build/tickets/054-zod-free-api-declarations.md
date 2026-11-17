---
type: grilling
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794843940
claimed_at: 2026-11-16T16:21:08Z
---

# How do `/types` and `/client` ship declarations that don't need Zod?

## Question

Spec §10 says users of `@pokemon-memory-reader/api`'s `/types` and `/client` never install Zod. [API package build and check](./012-api-package-build-and-check.md) found that `dist/schemas.d.ts` imports `zod`, and `types.d.ts` and `client.d.ts` import from it, so a project without `zod` or `skipLibCheck` gets TS2307 (reproduced with a packed tarball in a clean directory). Decide how the types stop depending on Zod: hand-written interfaces kept in sync by a test, a generated declaration file, a Zod peer dependency, or relaxing §10. See [the 012 report](../assets/012-api-package-build-and-check-report.md).

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

A grilling subagent decided this in auto mode on 2026-11-16, and the council approved it in round 1 (claude 8, gemini 10, gpt 9). [Amendment 054](../assets/054-zod-free-api-declarations.md) has the full text, which spec §10 will cite. The decision report is [054-zod-free-api-declarations-report.md](../assets/054-zod-free-api-declarations-report.md).

- `src/types.ts` holds hand-written types with no `zod` or `./schemas.js` import. Wherever the schema is loose, the type carries `[key: string]: unknown`, so the published types match the ones 012 shipped. Enum unions are literal unions. The runtime tuples stay in `schemas.ts` as `as const satisfies readonly <Union>[]`. Nested objects stay inline.
- `schemas.ts` imports each type from `types.ts` under an alias and exports it under the schema's name, so each name has one declaration and server imports do not change.
- A sync test has three parts. `bun run typecheck` checks `Equal<z.infer<S>, T>` for each pair, and that `ResourceMap`, `Topic` and each enum tuple equal their schema output. A runtime test fails when an exported Zod schema has no pair.
- Exported `/client` signatures use only `types.ts` types or built-ins. That covers `subscribe`, SSE payloads and `validate: boolean`.
- The `api-package` CI job gains a consumer smoke check. It installs the tarball into a temp project outside the workspace, asserts `zod` is absent, and typechecks imports from `/types` and `/client` under `nodenext` and `bundler` with `skipLibCheck: false`.
- §10's `/types` line becomes "hand-written TypeScript types, checked equal to the `/schemas` inferred types". `zod` ^4 stays an optional peer dependency.
- A new task ticket, "Zod-free /types and /client declarations", builds this. Any ticket that adds a public schema, an SSE event or a `/client` signature waits for it.

Why: plain interfaces need no new tooling, and the equality test turns any drift into a CI failure. Only a clean consumer install catches a Zod import that comes back. Excluded: a generated declaration file, a required `zod` peer, relaxing §10, types without the index signature, a fourth subpath, and named exports for nested shapes.
