# `GET /manual-picks` candidates list: decision report

Ticket: [`GET /manual-picks` candidates list](../tickets/108-manual-picks-candidates-list.md) (task).

## Run

- The parent session ran the Jev audit, so this child skipped it.
- Council: the Gemini and GPT seats are out of quota, so one Claude seat (Haiku) judged. Gemini and GPT: not run. It approved in round 1 with a score of 8 and five minor problems, all declined below.
- The master's overrides replaced the runner's commit gate, CI steps and map edit. This report is committed with the work, and the branch never merges.
- `bun test`: 1547 pass, 1 fail. The failure is the known Lua version check, which sees Lua 5.5 on this host. Typecheck and `biome ci` are clean.

## Decisions

| # | Question | Options | Choice | Made by | Audit |
|---|---|---|---|---|---|
| 1 | Where does the body type live? | Local to the server; `internal/` | `manualPicksBody` and `pickCandidate` in `internal/src/manual-picks-route.ts`, so the viewer can import them ([ticket 112](../tickets/112-manual-picks-body-type-swap.md)). | Ticket, 021 | Accepted |
| 2 | When is the list filled? | Unidentified only; unidentified or a manual match | Unidentified or a manual match, because 021 allows a pick change while the match is manual. An automatic match, no ROM and another platform get an empty list. The ticket's acceptance text says "unidentified, empty otherwise"; 021 wins. | Implementer, 021 item 8 | Accepted |
| 3 | Which profiles are candidates? | All profiles; those of the ROM's platform | Every loaded profile of the ROM's platform, header matches first, then name, then id. | 021 item 8 | Accepted |
| 4 | How is `baseEligible` computed? | Copy the rule; one shared function | New `baseEligible(game, headerMatch, signature)` in `identify.ts`, used by the pick lookup and the route. | 021 item 8 | Accepted |
| 5 | How are signatures read without blocking a tick? | One big read; small requests through the slot | `readSignatures` cuts reads into requests of at most 64 ranges and 4096 bytes, and each goes through the loop's `exclusive` slot, so a tick waits for at most one. | Implementer | Accepted |
| 6 | Is the signature result cached? | Read per call; cache per session | Cached per session and shared by concurrent calls, since the ROM doesn't change under a loaded game. A read that gave nothing or threw is dropped so the next call retries. | Implementer | Accepted, the throw path added after self-review |
| 7 | What is `current` for a session-only pick? | A fake key; null | null, because `key` is a required string and no saved entry applied. The viewer reads `status.game.match` for the manual state. | Implementer | Accepted |
| 8 | How does an adapter with no ROM read report? | Skip candidates; list them unchecked | Every profile listed as `unchecked` with no header match and no base pick, per amendment 025. | 025 | Accepted |
| 9 | `expansion_rom` empty list? | Wire it now | Not wired. No RHHEXP scan exists, and the ticket for it already covers wiring it. | Implementer | Accepted (disclosed) |

## Audit rounds

1. APPROVE, 8. Gemini and GPT: not run.

## Minor problems declined

- A single profile over the chunk cap is sent alone. Declined: signature plans hold a few words, and the profile schema doesn't allow a plan near the caps.
- The 4096-byte cap isn't asserted. Declined: the 64-range cap exercises the same batching code.
- No positive GB test. Declined: the filter uses the same `platformOf` map the pick route tests already cover for GB.
- `plans[i]?.judge([]) ?? null` for an undefined plan. Declined: `plans` is built from `candidates`, so the index is always defined.
- The body is a snapshot taken before the reads. Declined: identification changes replace the session, and `current !== session` re-runs the call.
