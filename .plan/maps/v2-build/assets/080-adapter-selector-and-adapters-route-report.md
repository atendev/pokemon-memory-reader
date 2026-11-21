# Adapter selector, discovery and `/adapters`: decision report

Audit: APPROVE in round 3. Claude seat scored 8. Gemini and GPT are `n/a` (out of quota). Three minor problems declined.

## What was built

- `server/src/adapter/selector.ts`: a facade `Adapter` for the read loop, plus `list`, `probeNow`, `switchTo`, `setPin` and `close`.
- `internal/src/adapters-route.ts`: Zod schemas for `/adapters` and the switch body.
- `/adapters`, `/adapters/probe` and `/adapters/switch` in `app/app.ts` and `route-table.ts`. `main.ts` builds the mGBA and RetroArch adapters, and a live `adapter` setting change goes through `setPin`.
- `ManagedAdapter.lastMiss` (optional), set by the RetroArch adapter, so `refused` and `no_reply` can be told apart.

## Decisions

| Question | Options | Choice | By |
|---|---|---|---|
| How does a RetroArch miss show, when a miss changes no adapter state? | Add a state field, or an optional `lastMiss` on the managed adapter | Optional `lastMiss` with a timestamp, compared against the last time it answered | Implementer |
| What blocks a lower-priority adapter? | Go live on the first usable adapter, or wait for higher ones to settle | A usable lower adapter waits up to 1.5 s while a higher one is unsettled | Implementer |
| How does probe-now connect an idle adapter? | A new probe call, or `hold` mode | `hold`, waiting 3 s per bridge and 1 s for RetroArch. The backoff is not reset | Implementer |
| What does a switch check? | Hello and game message, or the adapter's `connected` state | `connected` with no problem. The bridge adapter sets that only after its strict hello check, and a null game is valid, so a game message cannot fail | Implementer, upheld by the council in round 2 |
| A pin set while a switch runs | Let the switch win, or let the pin win | The pin wins and the switch answers `adapter_pinned` (council round 1) | Council seat, fixed |
| What does `status.adapter` show when the live adapter stops responding? | New "unresponsive" problem code, or the existing signals | Existing signals only. Silence on an open socket is `stalled`. A fault keeps its problem code after a drop. A clean drop reads disconnected with no problem, by spec §4.7. A new code would break the closed enum in amendment 020 | Implementer, upheld by the council |

## Audit

- Round 1: DISAPPROVE 6, five blocking. Fixed: pin during a switch, a `/adapters/probe` route test, a kept-problem test, a switch-not-remembered test. Rebutted: the game check, the epoch bump as the resource drop, and the retained hello.
- Round 2: DISAPPROVE 6, one blocking on the silent-drop path. Added a test that pins the clean-drop behaviour and rebutted with the `stalled` evidence.
- Round 3: APPROVE 8.

Minor problems declined: the test cannot show the old adapter's connection closing (the epoch bump and `probe` mode are the drop signal); the selector cannot write config because it has no config writer; a non-null game arriving after connect is not tested.

## Left for later

- A clean drop of a live adapter reads disconnected with no problem, which departs from the ticket's literal "shown as a problem". The spec §4.7 rule holds. Recorded in the answer.
- Adapters are built once with the startup endpoint, so a live `endpoints` change is not applied.
- BizHawk returns null from the selector's `create`.

Tests: 1170 pass, 1 known failure (Lua 5.5 version check in `server/test/bridge/core.test.ts`). Typecheck and `biome ci` clean.
