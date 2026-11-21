# Change detection and the `stalled` flag: decision report

## Result

The read loop now implements spec §8.6. Each resource skips its decode when its raw bytes match the last tick's, and otherwise decodes, deep-compares to the last emitted value and emits only on a difference. `status.adapter.stalled` turns true after 1 s of consecutive batch timeouts and clears on the next good read. Change events go to an internal subscriber list (`onChange`) that the SSE ticket reads. Local checks: lint and typecheck clean, 954 tests pass, 1 fails. The failure is the Lua version check in `server/test/bridge/core.test.ts`. This host runs Lua 5.5 and the test accepts 5.3 or 5.4. It fails the same way on `wayfinder/v2-build-master`, so this ticket did not cause it.

## Decisions

1. **Stall counted per batch, not per request.**
   - Question: does a read cycle that sends two requests (the battle frame follow-up) count as one timeout or two?
   - Choice: each main batch reports its own outcome to the tracker. The run of timeouts starts at the start of the first timed-out batch, and 1 s after that start sets `stalled`.
   - Made by: implementer. Audit: approved.
2. **A bridge error is neutral.**
   - Question: does a failed read that isn't a timeout end a run of timeouts?
   - Choice: no. Spec §8.6 says bridge errors don't count. A bridge error neither counts nor ends the run, and it shows that batches are still running (see decision 6).
   - Made by: implementer. Audit: approved.
3. **Identification reads count, box reads don't.**
   - Choice: the identification batch and the main batch report to the stall tracker. Box requests never do (spec §8.3, §8.6). This is also how cold-read timeouts count, since a cold GET runs through the same batch path.
   - Made by: implementer. Audit: approved.
4. **A status event only on a stall flip.**
   - Question: when does the loop emit a `status` change event?
   - Choice: only when `stalled` flips. Other status changes come from the adapter's state, not from the loop.
   - Made by: implementer. Audit: approved.
5. **Battle skip gated on `failingSince`, and the hash is kept only for a clean decode.**
   - Choice: while the battle tracker is failing validation, every tick decodes, so the tracker can time its warning. The raw hash is stored only after a successful decode and only when the battle frame isn't pending. A failed decode therefore leaves state unchanged and retries on the next tick. `stalled` lives on the `Session`, so a new game starts clear. The cold GET also deletes the raw hash.
   - Made by: implementer. Audit: approved.
6. **A pause with no batches breaks the run.**
   - Question: round 1 found that `since` was cleared only by a good read. A timeout at 0 s, a minute with nothing demanded, and one cold-GET timeout at 60 s set `stalled` from a single timeout.
   - Options: leave it, since the two timeouts are consecutive batches. Or end the run when more than 1 s passes between batches.
   - Choice: end the run after a pause over 1 s. A `begin(startedAt)` helper runs at the start of both `timeout` and `failed`. Round 2 found that `failed` first only recorded activity, so a bridge error after a long pause carried the old run over. It now runs `begin` too, and `failed(startedAt, now)` takes the batch start.
   - Tests: "a timeout after a pause with no batches starts a new run", "a bridge error after a pause doesn't carry the old run over". The first fails with the gap check removed. The existing cold-read test now steps the clock in 200 ms ticks, because one `advance(1100)` fires one tick on `ManualClock`. In real use the 5 s demand window keeps ticks running between cold reads.
   - Made by: council seat found both problems, implementer fixed them. Audit: round 3 approved.

## Audit

Council with the Claude seat only. The Gemini and GPT seats were out of quota and report `n/a`.

| Round | Claude | Result |
| --- | --- | --- |
| 1 | DISAPPROVE, 6 | blocking: a stall run survived a long pause. Minor: decode failures only log at debug. |
| 2 | DISAPPROVE, 6 | blocking: a bridge error after a pause kept the old run. |
| 3 | APPROVE, 8 | one minor problem |

Minor problems declined (2):

- Round 1: a decode failure doesn't reach the battle tracker and isn't counted. The baseline already logs decode failures at debug (`read-loop.ts` on `wayfinder/v2-build-master`). Battle validation runs inside the tracker, and failure counters belong to the later metrics ticket (spec §9.9).
- Round 3: the "pause with no batches" test might not exercise the gap check if `respond = () => null` counts as a good read. The test fails with the gap check removed, so it does exercise it. The bridge-error test covers the second path.

## Skipped gates

The Jev audit (the parent session ran it). The commit question (the master merges). CI (the master runs it on the merged batch).
