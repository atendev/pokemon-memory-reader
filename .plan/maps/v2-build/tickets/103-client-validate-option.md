---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T15:30:00Z
---

# Client `validate` option for `subscribe` and `get`

## What to build

[SSE stream, topics and slow clients](./071-sse-stream.md) shipped `StreamEvent` and `subscribe` without a `validate` option, because a test forbids any `/schemas` import in `client.ts`. Add `validate` to `subscribe` and `get`. It lazy-loads `/schemas` with a dynamic import behind the option, drops an invalid event and reports it as a `PmrApiError` of kind `invalid`. Change the import test to allow a dynamic import behind the option and nothing else, so a client that never sets `validate` still loads no `zod`.

## Acceptance criteria

- With `validate` set, a bad event or response is reported as `PmrApiError` kind `invalid`, and good ones pass through.
- Without it, `/client` loads no `/schemas` code, and the packed-tarball check without `zod` still passes.
- The import test names the one allowed dynamic import.

## Answer

`validate?: boolean` joins `ClientOptions`, so `get`, `getStatus`, `getParty` and `subscribe` all take it. With it set, `/client` loads `/schemas` through the one dynamic import `import("./schemas.js")` and checks each answer or event against `resourceSchemas[topic]`. A bad one becomes a `PmrApiError` of kind `invalid` with the `ZodError` as `cause`. A bad event is dropped and reported through `onError`, and good events reach handlers in arrival order through a queue. A missing `zod` also reports `invalid`. Without `validate`, `/client` loads no `/schemas` code. `sync.test.ts` allows only that one dynamic import, and the tarball smoke runs the client with no `zod` installed. [Report](../assets/103-client-validate-option-report.md).

Excluded: a static or type-only import of `/schemas` in `client.ts`, validating unknown topics, and passing data through when `zod` can't load.

Timing: wall 4m, active 4m, user 0s, wait 0s, blocked 0s | setup 1m, implement 1m, audit 1m (2 rounds) | tools 31 (4 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 95k | cost $1.01 sonnet-5-5 + $0.01 haiku-5-5
