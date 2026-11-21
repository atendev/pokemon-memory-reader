# Decision report: battle tracker core and `battle` schema (ticket 067)

Branch `t3/battle-tracker-core-schema-1`, built from the handoff at `3d46e02`. The council ran the Claude seat only. Gemini and GPT seats skipped (out of quota).

## What was built

- `server/src/resource/battle-tracker.ts`: a pure fold, `battleTracker`, over `BattleTick` (`set`, `clear`, `ended`). It has no emulator I/O.
- `api/src/types.ts` and `api/src/schemas.ts`: the `Battle` union (`ActiveBattle`, `InactiveBattle`), `LastBattle`, `Battler`, `BattleMove`, `Trainer`, `OpponentMon`, `SideConditions`, `StatStages`, the open `BattleMode`, and the closed kind, format and outcome lists.
- `api/src/meanings.ts`: an empty `BATTLE_MODES` meaning record under `OPEN_ENUMS.battleMode`, per amendment 015. The open-enums doc, its renderer and its test accept an empty record.
- Sync tests pair every new type with its schema. The closed-enum walker in `schemas.test.ts` now handles unions and walks `Battle`. The schema snapshot gained 361 lines and lost none.
- 28 tracker tests in `server/test/resource/battle-tracker.test.ts`, with frames in `server/test/support/battle-frames.ts`.

## Decisions

| # | Question | Options | Choice | Made by |
| --- | --- | --- | --- | --- |
| 1 | Does this ticket add the `battle` topic to `TOPIC_NAMES`, `ResourceMap` and `resourceSchemas`? | Add it now, or leave it to the route ticket | Leave it. Ticket 068 (Gen 3 battle decoders) adds it with the route. | Implementer |
| 2 | What does the tracker emit when the first read fails validation before anything was served? | Emit nothing, or emit the inactive shape once | Emit the inactive shape once, then nothing while validation keeps failing. The resource always has a value after the first read. | Implementer |
| 3 | Which fields are nullable? | Strict or nullable | `classId` is nullable. `Trainer.items` is `Ref[] \| null`. `Battler.stats` is non-null. | Implementer |
| 4 | Does `revealed` ever drop a slot mid-battle? | Recompute each frame, or keep it | HP below max is sticky: once a slot is revealed it stays revealed for the battle. Wild battles are always revealed. | Implementer |
| 5 | What outcome does the Gen 1 `0xFF` end marker give? | `lost` or `unknown` | `unknown`, held in `GEN1_END_MARKER_OUTCOME`. Amendment 025 item 4 says it becomes `lost` once a fixture confirms a loss. | Implementer, from 025 |
| 6 | Where does the 2 s validation warning clock start? | Per battle, or per flag-set period | Per flag-set period, as amendment 025 item 2 says. `warned` resets when the flag clears. | Implementer, from 025 |
| 7 | How does a reconnect to the same game avoid a second battle? | Tracker detects it, or the caller keeps state | The caller keeps the state across a reconnect and calls `initial()` only for a game change or restart. The tracker stays pure. | Implementer, from spec §7.8 |
| 8 | How are `modes` ordered? | Locale order, UTF-16 order, code-point order | Unique and sorted by code point (amendment 015 item 6). | Council fix, round 1 |

## Audit

| Round | Seat | Verdict | Score |
| --- | --- | --- | --- |
| 1 | Claude (haiku) | APPROVE | 8 |
| 2 | Claude (haiku), changed hunks | APPROVE | 9 |

Gemini and GPT seats skipped (out of quota). Approval rests on the Claude seat.

Round 1 raised four minor problems.

1. The reconnect test title claimed it checked logging, but the test only checks ids and `lastBattle`. Fixed: retitled it and added an assertion that exactly one output carries a frozen `lastBattle`. Logging belongs to the caller.
2. `byCodePoint` compared UTF-16 units, not code points. Fixed: it now compares code points, and a new test orders U+FF21 before U+1F600.
3. The schema is a loose object, so a payload with `lastBattle` still parses as an active battle. Declined. Other unions in the API use loose objects, and the tracker tests cover the never-while-active rule.
4. The ticket says one warning per battle, while `warned` resets per flag-set period. Declined. Amendment 025 item 2 sets the per-period rule, and a flag-set period sits inside one battle.

Round 2 returned no problems.

## Verification

Typecheck and `biome ci` pass. 598 tests pass. One test fails: `core.test.ts` checks for Lua 5.3 or 5.4, and the host's default `lua` is 5.5. It is unrelated to this ticket and was left alone.

## Gates skipped

The Jev audit (the parent session ran it), the Gemini and GPT council seats (out of quota), CI (the master runs it on the merged batch), and the merge question (the master merges).
