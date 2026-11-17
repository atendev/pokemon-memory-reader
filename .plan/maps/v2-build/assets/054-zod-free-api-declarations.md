# Amendment 054: Zod-free `/types` and `/client` declarations

Spec §10 cites this amendment. It comes from the grilling ticket [How do `/types` and `/client` ship declarations that don't need Zod?](../tickets/054-zod-free-api-declarations.md). The [Zod-free /types and /client declarations](#follow-up) task ticket builds it.

## Problem

[API package build and check](./012-api-package-build-and-check-report.md) found that `dist/types.d.ts` and `dist/client.d.ts` import `dist/schemas.d.ts`, which imports `zod`. A consumer that installs neither `zod` nor sets `skipLibCheck` gets TS2307. Spec §10 promises that users of `/types` and `/client` never install Zod.

## §1 Hand-written types

- `src/types.ts` holds hand-written TypeScript types for every public shape. It imports nothing from `zod` or `./schemas.js` and has no runtime code.
- Wherever the schema is a `z.looseObject`, the type carries `[key: string]: unknown` at that level, nested objects included. `z.infer` of a loose object has that index signature, so the published types stay the same as the ones 012 shipped.
- Enum unions are literal unions, such as `type Nature = "hardy" | "lonely" | ...`. The runtime tuples `TYPES`, `NATURES`, `STATUSES` and `TOPICS` stay in `schemas.ts`, each declared `as const satisfies readonly <Union>[]`.
- `Topic` and `ResourceMap` are hand-written in `types.ts`.
- Nested anonymous objects stay inline in their parent type. Examples are `Pokemon["met"]`, `Game["features"]`, `AdapterInfo["bridge"]["emulator"]`, `Rom["expansion"]` and `ErrorBody["error"]`. `/types` exports exactly the names that `/schemas` exports as schemas. Giving a nested shape its own name is an additive change, and the same commit adds a named schema and a sync pair for it.
- TSDoc goes on a field only when its name does not explain it, for example why it can be null, or that it is an open enum. Each field's `.describe()` on the schema stays the documentation source for OpenAPI (spec §7). No test compares the two texts.

## §2 One declaration per name

`schemas.ts` keeps its schema consts and takes each type name from `types.ts`:

```ts
import type { Party as PartyType } from "./types.js";
export const Party = z.looseObject({ pokemon: z.array(Pokemon) });
export type Party = PartyType;
```

`import { Party } from "@pokemon-memory-reader/api/schemas"` still gives both the value and the type, so server and test imports do not change. `schemas.d.ts` imports `types.d.ts`, which is safe because `/schemas` users already install Zod. `types.d.ts` never imports `schemas.d.ts`.

## §3 Sync test

Three checks keep the types and schemas equal. A failure in any of them fails CI.

1. A type-level `Equal<z.infer<typeof S>, T>` assertion for each pair in a pair list. Today the list is `Type`, `Nature`, `Status`, `Ref`, `Stats`, `Move`, `Pokemon`, `Party`, `Rom`, `Game`, `AdapterInfo`, `StatusResource` and `ErrorBody`. `bun run typecheck` checks these assertions.
2. Mapped checks. `{ [T in Topic]: z.infer<(typeof resourceSchemas)[T]> }` equals `ResourceMap`. `(typeof TOPICS)[number]` equals `Topic`. Each enum tuple's `(typeof X)[number]` equals its union in both directions, because `satisfies` alone misses a missing member.
3. A runtime test in `bun test`. It collects every export of `schemas.ts` that is a Zod schema instance, which skips `TOPICS`, `resourceSchemas` and the tuples. It then checks that set against the names in the pair list. A new exported schema without a pair fails this test.

The checks compare against `z.infer`, which is the schema output, and never against `z.input`. The types describe response bodies. A schema that later gains a transform or a default keeps its hand-written type equal to its output.

## §4 What `/client` may reference

- Every exported signature in `/client` uses only types from `types.ts` or TypeScript built-ins. That covers the `get` helpers, `subscribe`, its handlers, the `connection` state and `ClientOptions`.
- SSE event payload types are hand-written in `types.ts`. Their schemas live in `schemas.ts` with pairs in the sync test.
- `validate` is a `boolean`. `validate: true` loads `/schemas` with a dynamic `import()` inside a function body. Exported functions have explicit return types, so the import's type never reaches a published signature.

## §5 Consumer smoke check

The `api-package` CI job gains one step after `attw`:

1. Install the packed tarball with `bun add <tarball>` into a fresh temp directory outside the workspace, so a hoisted `zod` cannot leak in. Install the repo's pinned TypeScript there.
2. Fail if `node_modules/zod` exists.
3. Typecheck a file that imports from `/types` and `/client` twice. One run uses `module` and `moduleResolution` `nodenext`. The other uses `module: esnext` and `moduleResolution: bundler`. Both use `strict: true` and `skipLibCheck: false`. These are the two resolutions that attw's `esm-only` profile covers.

`publint` and `attw` did not catch the 012 bug. This step does, including a later edit that adds a `./schemas.js` import back to `client.ts`.

## §6 Spec text changes

- §10 `/types` reads: "hand-written TypeScript types, checked equal to the `/schemas` inferred types. No runtime code and no Zod import."
- §10 **Zod** adds: "The `/types` and `/client` declarations never import `zod` or `/schemas`, even transitively. The sync test (amendment 054 §3) and the consumer smoke check (amendment 054 §5) enforce this."
- `zod` ^4 stays an optional peerDependency. Making it a regular dependency would install Zod for the overlay users who §10 says never need it.
- §10 **CI** adds the consumer smoke check.

## §7 Ordering

Any ticket that adds a public schema, an SSE event or a `/client` signature follows §1 to §4: a hand-written type, a sync pair, and Zod-free declarations. Until the follow-up task ticket resolves, those tickets are blocked by it, so no new Zod-inferred type lands that the task would have to rewrite. The master adds the blocked-by link when it creates them.

## Follow-up

A new `task` ticket, "Zod-free /types and /client declarations", blocked by nothing, builds §1 to §5 for the current schemas. It also removes the README note that says every declaration file imports Zod types. Its acceptance criteria are the §3 checks passing, the §5 smoke check passing in CI, and `publint` and `attw` still green.

## Excluded

- A generated declaration file, made from `z.infer` through the compiler API or from `z.toJSONSchema` with a JSON-Schema-to-TypeScript tool. It needs a generator and new dev dependencies. Its output writes nested shapes inline without the `Ref` and `Stats` names, which makes it harder to read.
- A required `zod` peer dependency. It breaks the §10 promise.
- Relaxing §10 and documenting `skipLibCheck`. It also breaks the §10 promise, and the 012 README note becomes permanent.
- Hand-written types without the index signature. The strict equality check fails against a loose schema, and an interface without one is not assignable to the inferred type. A recursive comparison that strips the signature would make the test complex for little gain.
- A fourth runtime subpath for the enum tuples. §10 fixes the subpaths at three.
- A separate exported name for each nested shape. It adds public names that have no schema behind them.
