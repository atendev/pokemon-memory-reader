# Decision report: Coverage matrix, guard and the `supported` flag

Ticket: [093](../tickets/093-coverage-matrix-and-support-gate.md). Task ticket, run as a child of wayfinder-master on 2026-11-21 (UTC), over two threads (the first handed off at the context limit). It builds spec §12.7 and §12.8 and the `supported` flag that [the tracer](./009-tracer-api-report.md) left out (decision 5). No grilling or research ran.

## What changed

- `server/src/format/support.ts`: `SUPPORTED` holds one flag per data format, all `false`. `isSupported` answers for a format, and a format the build doesn't know is never supported. `assumeSupported` reads `PMR_ASSUME_SUPPORTED`, a comma-separated list of formats to serve anyway.
- `server/src/format/registry.ts`: `bindGame(profile, support = SUPPORTED)` returns `{ supported: false }` for an unsupported format and binds no parts. `BoundGame.supported` is optional, and `bindGame` always sets it.
- `server/src/loop/read-loop.ts`: `unavailable` returns 503 `unsupported` when `bound.supported === false`, before the per-resource check. The 503 order stays that of [amendment 020](./020-status-and-error-details.md). `ReadLoopDeps.supported` and `ServerOptions.supported` pass the flags in.
- `server/src/main.ts`: applies `PMR_ASSUME_SUPPORTED` and logs a warning naming the assumed formats and any unknown names.
- Matrix: `server/test/fixtures/coverage.ts` lists the required states per tier. Guard and scan: `server/test/support/coverage-guard.ts`. Renderer: `server/test/support/coverage-report.ts`.
- `scripts/coverage.ts`, run as `bun run coverage` (`--check` compares without writing), generates `docs/coverage.md`. Nothing edits that page by hand.
- Tests: `coverage.test.ts`, `support-flags.test.ts`, and a "the support gate" block in `read-loop.test.ts`. The older loop tests pass `supported: ALL_SUPPORTED` from `server/test/support/supported.ts`. The compiled-executable test sets `PMR_ASSUME_SUPPORTED=gen3`.

## Evidence

- `bun test`: 1665 pass, 1 fail. The failure is the Lua 5.5 case in `bridge/core.test.ts`, which fails on this machine without this work.
- `bun run typecheck` and `bun run lint`: clean.
- The default suite fails when `docs/coverage.md` is stale, and a second test shows the page changes when a flag, a fixture or the matrix changes.
- The viewer needed no change. `App.tsx` already renders the connection screen's `unsupported` state when the Party resource answers 503 `unsupported`, and the server now sends that code.
- No ROM, emulator or fixture capture ran. Every format ships `supported: false`.

## Decisions

| # | Question | Options | Choice | Made by | Audit |
| --- | --- | --- | --- | --- | --- |
| 1 | Where does `supported` live? | On `Profile`; or a per-format table | A per-format table in `support.ts`, keyed by `dataFormat`, as spec §6.1 and §12.8 define support per format | Implementer | Approved in round 2 |
| 2 | How does a developer run a format with no fixtures? | No override; or an env override | `PMR_ASSUME_SUPPORTED=<formats>`, wired in `main.ts` with a warning log. The compiled-executable test needs it, and a decoder can't gain fixtures without first being served | Implementer | Approved in round 2 |
| 3 | Where does the gate sit? | In each resource's check; or in `bindGame` | In `bindGame`, which returns `{ supported: false }`. `BoundGame.supported` is optional so existing test bindings stay valid. The read loop checks it first, which keeps 020's order | Implementer | Approved in round 2 |
| 4 | Does `status.game` gain a `supported` field? | Add a field; or report through the 503 code | The 503 code only. Spec §6.1 and amendment 020 give `status.game` no such field, and `status.state` stays `game` | Implementer | Rebutted in round 1, approved in round 2 |
| 5 | What does a resource the fixtures don't cover do at runtime? | Map each resource to a fixture and refuse at runtime; or let fixtures gate the flag | Fixtures gate the flag. The guard fails the suite when a format is flagged supported without every tier 1 state on every primary revision. A resource a decoder lacks still answers 503 `unsupported` through the registry | Implementer | Rebutted in round 1, approved in round 2 |
| 6 | Where does the matrix page live and what prints it? | The test prints it; or a script writes `docs/coverage.md` | The script writes the page and the test compares it. A test that writes files hides a stale page | Implementer | Approved in round 2 |
| 7 | Where do tier 2 gaps show? | Fail the suite; or list them | Listed in the page's "Tier 2 gaps" section. They never fail the suite (spec §12.8) | Implementer | Approved in round 2 |
| 8 | Which smoke fixtures does a `smoke` profile need? | One; or party and player | `smoke-party` and `smoke-player`. A profile's `fixture` level is `full`, `smoke` or `none`, and the guard checks the folder against it | Implementer | Approved in round 2 |
| 9 | How are field names written in the matrix? | Free text; or paths into the golden's `resources` | Paths, so the guard can check that a tier 1 golden verifies each named field | Implementer | Approved in round 2 |

## Audit

Claude seat only. Gemini and GPT: not run (out of quota).

- Round 1: `claude 5`, DISAPPROVE. Three blocking problems. The seat wanted `supported` on `status.game`, a viewer change, and a runtime refusal for a resource the fixtures don't cover. I rebutted all three with evidence. Spec §6.1 and amendment 020 give `status.game` no such field. `App.tsx:92-93` already renders the `unsupported` connection screen from the Party 503 code. Fixtures gate the flag per format, as spec §12.8 describes. One minor problem was declined (below).
- Round 2: `claude 8`, APPROVE. The seat withdrew the three blocking problems after checking the cited lines.

Declined or rebutted minor problems, all from the claude seat:

- The `proves-mode-*` states appear in neither table. Declined. `BATTLE_MODES` is an empty open enum today, and the spread adds the states when modes are added.
- The guard works per data format, so it never refuses one resource at runtime and tier 2 gaps serve once a format is supported. Declined as scope. That is the §12.8 design, and the seat agreed it is wording, not a defect.

## Left for later

- Capturing tier 1 fixtures and lifting `supported` needs ROMs and an emulator. It is surfaced as a ticket.
