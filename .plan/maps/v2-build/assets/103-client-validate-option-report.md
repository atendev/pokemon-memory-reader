# Client `validate` option: decision report

Ticket: [Client `validate` option for `subscribe` and `get`](../tickets/103-client-validate-option.md). Branch `t3/client-validate-option`. Auto mode, one Claude audit seat (Gemini and GPT: not run, out of quota).

## What shipped

- `ClientOptions.validate?: boolean`, so both `get` and `subscribe` take it.
- `PmrApiErrorKind` gains `invalid`.
- `client.ts` has one dynamic import, `import("./schemas.js")`, inside `loadSchemas`. Nothing else in `/client` reaches `/schemas`.
- `get` with `validate` checks the parsed body against `resourceSchemas[topic]`. A bad body throws `PmrApiError` kind `invalid` with `httpStatus` 200 and the `ZodError` as `cause`.
- `subscribe` with `validate` checks each known-topic event the same way. A bad event is dropped and reported through `onError`. Good events reach their handlers in arrival order.
- `sync.test.ts` now names the one allowed import: `client.ts` must hold exactly `import("./schemas.js")`, `types.ts` none, and no static import of `zod` or `./schemas` anywhere.
- `scripts/api-consumer-smoke.ts` typechecks `subscribe` with `validate` and runs the client under Bun in the zod-free temp project. A plain `get` works there, and `get` with `validate` reports `invalid`.
- README line for the new option.

## Decisions

| Question | Options | Choice | By |
| --- | --- | --- | --- |
| Where does `validate` live? | On `get` and `subscribe` only, or on shared `ClientOptions` | Shared `ClientOptions`, since `getStatus` and `getParty` take `ClientOptions` and need it too | Main thread |
| Which schema checks an event? | `StreamEvent`, or `resourceSchemas[topic]` | `resourceSchemas[topic]`. They match, and it needs no per-event wrapping | Main thread |
| What if `/schemas` or `zod` can't load? | Pass the data through, throw a plain error, or `invalid` | `PmrApiError` kind `invalid` with the load failure as `cause`. The caller asked for validation and didn't get it | Main thread |
| How do async checks keep event order? | Check each event on its own, or chain them in a queue | A promise queue, so a slow first import can't reorder events | Main thread |
| Unknown topics with `validate`? | Reject, or pass to `onUnknown` unchecked | Unchecked, as before. There is no schema to check against | Main thread |
| How to type the schemas without a static import? | `import type` from `./schemas`, or infer from `loadSchemas` | Infer through `Awaited<ReturnType<typeof loadSchemas>>`, so the file holds one import expression | Main thread |
| How to prove "no `/schemas` code without `validate`"? | Module-graph check, or runtime in the packed tarball | Source test for the import plus the tarball smoke at runtime with no `zod` installed | Main thread |

## Audit

- Round 1, Claude seat: DISAPPROVE, 7. Blocking: a throwing handler rejected the queue, so the next event skipped validation and `onError` got a raw exception. Fixed. The queued step now never rejects. A throwing handler or `onError` is rethrown with `queueMicrotask`, as it would escape the listener without `validate`. A new test covers a handler that throws between a bad and a good event.
- Round 2, Claude seat: APPROVE, 8. One minor problem declined: `if (failure)` tests truthiness. `validateResource` only throws `PmrApiError`, so the value is never falsy.
- Gemini and GPT: not run.

## Checks

`bun test api` 203 pass, typecheck and Biome clean, tarball passes publint, attw and the consumer smoke. The full suite has one failure that has nothing to do with this change: `core.test.ts` expects Lua 5.3 or 5.4 and this machine has 5.5. CI uses 5.4.

## Gates skipped

CI steps 6 and 7 (the master runs CI). The commit gate (commit every time, per the brief).
