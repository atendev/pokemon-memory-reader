# How do `/types` and `/client` ship declarations that don't need Zod? Decision report

Ticket: [How do `/types` and `/client` ship declarations that don't need Zod?](../tickets/054-zod-free-api-declarations.md). Branch `t3/zod-free-types-client-declarations`. The main thread ran this grilling ticket in auto mode as a child of wayfinder-master. The main thread wrote the questions, options and recommendations. A sonnet grilling subagent answered them in three rounds and accepted every recommendation. The council approved the amendment in round 1 (claude 8, gemini 10, gpt 9). The repo has no `workflow.md`, `AGENTS.md` or `CLAUDE.md` of its own, so the runner steps apply with the master's overrides. The commit gate commits without asking, the branch is pushed for the master to watch CI, and `map.md` stays untouched.

The amendment is [054-zod-free-api-declarations.md](./054-zod-free-api-declarations.md).

## Evidence gathered before the grilling

The main thread ran a type probe with TypeScript 7.0.2 and zod 4.6.7. `z.infer` of a `z.looseObject` comes out as `{ [x: string]: unknown; ...fields }`. A hand-written interface with `[key: string]: unknown` passes a strict `Equal` check against it. An interface without the index signature fails the check, and TypeScript refuses to assign it to the inferred type (TS2322). A second probe confirmed that `export const Party = z.looseObject(...)` with `export type Party = PartyType` typechecks. It also confirmed that `instanceof z.ZodType` over a module's exports finds the schema and skips an `as const` tuple. The probe files were deleted.

## Decisions

Each entry gives the question, the options, the choice and who made it. The grilling subagent made every choice by accepting the main thread's recommendation.

**Q1. Mechanism.** The options were (a) hand-written types in `types.ts`, checked equal to the schemas by a type-level test, (b) a generated declaration file, (c) a required `zod` peer dependency, and (d) relaxing §10 and documenting `skipLibCheck`. The choice was (a). It needs no new tooling, the published types are plain named interfaces that can carry TSDoc, and drift fails `bun run typecheck`. Option (b) needs a generator, and its output writes nested shapes inline. Options (c) and (d) break the §10 promise. The subagent added that the index signature is required wherever the schema is loose.

**Q2. Regression guard.** The options were a consumer smoke check in the `api-package` CI job, or relying on the equality test. The choice was the smoke check, because `publint` and `attw` missed the 012 bug.

**Q3. Ticket scope.** The options were writing the amendment only, with a new task ticket doing the build, or building it here too. The choice was the amendment only, per the map note that grilling tickets decide and task tickets build. The task ticket also removes the README limit note.

**Q4. Enum unions and runtime tuples.** The options were literal unions in `types.ts` with the tuples staying in `schemas.ts`, or a fourth runtime subpath. The choice was literal unions, with each tuple declared `as const satisfies readonly <Union>[]` and checked equal in both directions. §10 fixes the subpaths at three. The subagent noted that `satisfies` alone misses a missing member.

**Q5. Which module owns the type names.** The options were `schemas.ts` taking each type from `types.ts` under the schema's name, or two parallel declarations per name. The choice was one declaration per name, so server imports do not change. The subagent corrected the mechanics. `export type { Party } from` clashes with `export const Party`, so `schemas.ts` must import the type under an alias and export a type alias. The probe confirmed this form.

**Q6. Completeness of the sync test.** The options were three checks (Equal per listed pair, mapped checks on `ResourceMap` and `Topic`, and a runtime scan of Zod schema exports against the pair list), or the listed pairs only. The choice was all three, because only the scan catches a forgotten pair.

**Q7. What `/client` may reference.** The options were stating the rule now for `subscribe`, SSE events and `validate`, or deciding when `subscribe` is built. The choice was to state it now. Exported signatures use only `types.ts` types or built-ins, SSE payload types are hand-written with sync pairs, `validate` is a `boolean`, and exported functions have explicit return types.

**Q8. Field docs.** The options were TSDoc only where a field's name does not explain it, mirroring every `.describe()` with a text test, or no TSDoc. The choice was TSDoc only where needed, with `.describe()` staying the OpenAPI source, because a text-equality test is brittle.

**Q9. Smoke check settings.** The options were two runs (`nodenext`, and `esnext` with `bundler`) in a temp dir outside the workspace with a `zod` absence check, or one bundler run. The choice was two runs, matching attw's `esm-only` profile.

**Q10. Spec text and the peer dependency.** The options were rewriting only §10's `/types` line and keeping `zod` an optional peer, or also making `zod` a regular dependency. The choice was the rewrite only. A regular dependency would install Zod for the overlay users who §10 says never need it.

**Q11. Nested anonymous objects.** The options were inline in the parent type, or a named export for each. The choice was inline, so `/types` and `/schemas` stay one-to-one and the Q6 scan stays meaningful. Naming one later adds a named schema and a pair in the same commit.

**Q12. Which Zod type the check compares.** The options were `z.infer`/`z.output` only, or both input and output. The choice was output only, because the types describe response bodies. A future transform or default keeps the type equal to the output.

**Q13. Ordering.** The options were a rule that tickets adding a public schema, SSE event or `/client` signature wait for the task ticket, or no rule. The choice was the rule, with the master wiring the blocked-by link when it creates those tickets.

## Audit

Round 1: claude 8 APPROVE, gemini 10 APPROVE, gpt 9 APPROVE. The gate opened in round 1. The claude seat raised three minor problems, and no other seat raised any. The main thread declined all three:

| Problem | Outcome |
| --- | --- |
| §4 says "TypeScript built-ins", but `fetch` and `EventSource` come from the DOM or Node lib, and §5 does not name the consumer's `lib`. | Declined. §5 leaves `lib` unset, and TypeScript's default `lib` includes DOM. A consumer with no DOM or Node types is a separate question from Zod. |
| §5 assumes `bun add <tarball>` skips the optional `zod` peer. | Declined. If Bun installs it, the absence assertion fails in CI and the task implementer changes the install command. The check cannot pass silently. |
| "`/types` exports exactly the names that `/schemas` exports as schemas" is unclear for `Topic` and `ResourceMap`. | Declined. The sentence is about nested shapes, and §3 check 2 covers `Topic` and `ResourceMap` by name. |

## Surfaced

**Zod-free /types and /client declarations.** A `task` ticket, blocked by nothing. It builds amendment §1 to §5 for the current schemas and removes the README limit note. Its acceptance criteria are the §3 checks passing, the §5 smoke check passing in CI, and `publint` and `attw` staying green.

## Skipped gates

The runner's step 5 question to the user was skipped under the master's brief, which commits every time. The user was not interviewed; auto mode answered the grilling.
