# Gen 3 battle decoders and the `battle` resource: decision report

Branch `t3/gen3-battle-decoders-2`, attempt 2, picked up from the handoff at `c8bfad3`. The council ran the Claude seat only. Gemini and GPT seats skipped (out of quota).

## What shipped

- `server/src/format/gen3/battle.ts`: `gen3Battle` with a `probe` (flag and outcome byte, read every tick) and a `frame` (the whole battle, read while the flag is set), and `gen3Outcome`.
- The `battle` topic is now in `TOPIC_NAMES`, `ResourceMap`, `resourceSchemas` and the app's snapshot routes. `GET /api/v2/battle` serves it.
- The read loop reads the flag every tick, even with no client. A flag that reads set after a clear read gets its frame in a second request within the same tick, so `lastBattle` is complete when first asked (spec §8.2).
- Emerald `addresses` gained `gMain`, `gBattlerPartyIndexes`, `gBattleOutcome`, `gBattleWeather`, `gSideStatuses` and `gSideTimers` from the generator. Two generator runs left every profile file byte-identical.
- Tests: decoder tests, loop and route tests, an app route test, and a synthetic battle memory encoder (`server/test/gen3/battle-encode.ts`). `docs/open-enums.md` is regenerated and its test passes.

## Decisions

| Question | Options | Choice | Made by |
| --- | --- | --- | --- |
| Where does the "battle block" live? | A new profile `battle` key, or more keys in `addresses` | More keys in `addresses`. The ticket's "profile `battle` block" means these keys. | Implementer |
| How is the flag read? | Only while demanded, or every tick | Every tick (spec §8.2), with the outcome byte beside it. The frame is read only while the flag is set. | Implementer |
| When does a set flag get its frame? | Next tick, or at once | At once in a second request, so a battle shows within the tick. | Implementer |
| What does a double mean? | Bit 0 only, or bit 0 or TWO_OPPONENTS | Bit 0 only, as the ticket says. pret `battle_setup.c:1275` sets `DOUBLE | TWO_OPPONENTS | TRAINER` together. | Council seat raised it; implementer fixed |
| Partner `partySlot` | Guess an index, or null | Null until a fixture confirms it, as the ticket says. | Ticket |
| `gSideTimers` stride | 12 bytes (0x18 symbol size over two sides), or 11 (members in pret master) | 12. Only the opponent's spikes byte (+10) is read. See Surfaced. | Implementer |
| Caps check | Check the frame only, or probe and frame | The frame. The registry test now expects the main batch to hold `party` and `battle`, at 12 ranges. | Implementer |

## Audit

- Round 1: Claude seat DISAPPROVE 6. One blocking problem: no evidence of a stable generator second run. Rebutted: sha256 of every built-in profile was identical across two runs, and the tree stayed clean. The seat dropped it in round 2.
- Round 2: DISAPPROVE 7. One minor problem, that the double rule also counted the TWO_OPPONENTS bit. Fixed by following the ticket.
- Round 3: APPROVE 8. Two minor problems, both fixed after approval: the `battle_setup.c` citation and a test for the `DOUBLE | TWO_OPPONENTS | TRAINER` combination.
- Minor problems declined: none.
- Fixed from round 1: all-raw-byte outcome test, pret citations in comments, a stray test write removed.

## Known issues

- `server/test/bridge/core.test.ts` fails the Lua version check locally because the host's default `lua` is 5.5. CI uses 5.4. Ignored.
- The offsets for `BattlePokemon`, `gMain.inBattle` and the side bits come from pret, not a ROM. The synthetic tests reuse the same constants, so they prove self-consistency only. A real Emerald fixture will confirm them.
- `modes` is `[]`, `turn` is null, `trainers` is empty and partner `partySlot` is null, as the ticket says.
