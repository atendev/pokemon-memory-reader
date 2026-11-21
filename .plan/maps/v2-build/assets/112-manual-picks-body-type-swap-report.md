# Swap the local `ManualPicksBody` mirror for the type `internal/` exports: decision report

Ticket: [Swap the local `ManualPicksBody` mirror for the type `internal/` exports](../tickets/112-manual-picks-body-type-swap.md) (task).

## Run

- The parent session ran the Jev audit, so this child skipped it.
- Council: the Gemini and GPT seats are out of quota, so one Claude seat (Haiku) judged. Gemini and GPT: not run. It approved in round 1 with a score of 8 and one minor problem, fixed below.
- The master's overrides replaced the runner's commit gate, CI steps and map edit. This report is committed with the work, and the branch never merges.
- Viewer tests: 249 pass. The compiled-executable settings test: 9 pass against a fresh `bun run build:exe`. Typecheck and `biome ci` are clean.

## Decisions

| # | Question | Options | Choice | Made by | Audit |
|---|---|---|---|---|---|
| 1 | What replaces the local mirror? | Re-export from `internal-api.ts`; import from `internal/manual-picks-route` at each use | Each file imports `ManualPicksBody` from `@pokemon-memory-reader/internal/manual-picks-route`, as the viewer already does for the other bodies. The local interface is deleted. | Implementer | Accepted |
| 2 | What to do with the 404 message? | Keep a 404 branch; drop it | Dropped. The route exists now, so every failure shows "The candidate profiles can't be read right now." plus the program's message. | Ticket | Accepted |
| 3 | What happens to the 404 test? | Delete; fold into a failed-read test | Replaced by a test that a 500 shows its message and a pending read says it is reading. The old test also covered those two cases. | Implementer | Accepted |
| 4 | The test fixtures used `kind: "vanilla"`. | Cast; use a real value | `"official"`, because the imported type allows only `"hack"` or `"official"`. The mirror typed `kind` as `string`, which hid it. | Implementer | Accepted |
| 5 | How does the compiled-executable test show the pick list? | Drive the viewer in a browser; check the route and the bundle | A second suite runs the executable against a fake bridge with an unidentified ROM (crc32 `deadbeef`) and checks that `GET /manual-picks` lists `emerald-us-1.0` under key `crc32:deadbeef`. The first suite's bundle check now expects the reading text and rejects the 404 string. The control's rendering stays covered by the viewer unit tests. | Implementer | Accepted |

## Audit rounds

1. APPROVE, 8. Gemini and GPT: not run.

## Minor problems

- Fixed: the new test's title said the pick control shows the list, but the test checks the route only. The title now says only what it checks.
