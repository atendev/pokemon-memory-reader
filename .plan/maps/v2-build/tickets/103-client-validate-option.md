---
type: task
blocked_by: []
---

# Client `validate` option for `subscribe` and `get`

## What to build

[SSE stream, topics and slow clients](./071-sse-stream.md) shipped `StreamEvent` and `subscribe` without a `validate` option, because a test forbids any `/schemas` import in `client.ts`. Add `validate` to `subscribe` and `get`. It lazy-loads `/schemas` with a dynamic import behind the option, drops an invalid event and reports it as a `PmrApiError` of kind `invalid`. Change the import test to allow a dynamic import behind the option and nothing else, so a client that never sets `validate` still loads no `zod`.

## Acceptance criteria

- With `validate` set, a bad event or response is reported as `PmrApiError` kind `invalid`, and good ones pass through.
- Without it, `/client` loads no `/schemas` code, and the packed-tarball check without `zod` still passes.
- The import test names the one allowed dynamic import.
