---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795260524
claimed_at: 2026-11-21T11:40:00Z
---

# Change detection and the `stalled` flag

## What to build

Spec §8.6, in the slot `read-loop.ts` marks for it. Two stages: compare each resource's raw slice bytes to the last tick's and skip decoding when equal, otherwise decode, deep-compare to the last emitted value and emit only on a difference. The in-battle flag is part of the `battle` raw key. The first successful decode always emits and doubles as the on-connect value. A decode or validation failure emits nothing and leaves state unchanged.

Each batch has the 250 ms timeout. After 1 s of consecutive timeouts, `status.adapter.stalled` becomes true, and the next good read clears it. Cold-read timeouts count. Box timeouts and bridge errors don't. [The tracer](./009-tracer-api.md) kept `stalled` false (its decision 9), and this ticket replaces that. The change events go to an internal subscriber list that the SSE ticket reads.

## Acceptance criteria

- Tests with `ManualClock` cover raw-byte skips, deep-compare skips, first-decode emit, and a failed decode that emits nothing.
- Tests cover `stalled` turning true after 1 s of timeouts, clearing on a good read, cold-read timeouts counting, and box timeouts and bridge errors not counting.
- `status.adapter.stalled` reflects it through the real server and fake bridge.

## Handoff

Branch `t3/change-detection-stalled-flag`. Council audit rounds used: 0. Thread tag `wfm-v2-build-070-1795260524`.

**Done (implemented, all green except the unrelated Lua 5.5 test):**
- `server/src/loop/stall.ts`: `createStallTracker`. The run starts at the first timed-out batch's start, 1 s sets it, a good read clears it, a non-timeout failure is neutral.
- `server/src/loop/read-loop.ts`: stage one raw-hash skip per part (`session.raw`), stage two `isDeepStrictEqual` against `session.emitted`, `publish()`, `onChange(listener)` returning an unsubscribe, `ChangeEvent`. Boxes emit from `keepBoxes`, which also gained a deep-compare stage. `stalled` lives on the `Session`, so a new game starts clear. A stall flip emits a `status` event. The cold GET deletes the raw hash too. Battle skips only while the tracker isn't failing validation. Hash is stored only on a successful decode and only when the battle frame isn't pending. Identification and main batches report to the stall tracker. Box reads don't.
- `status.ts`: `StatusInputs.stalled` required.
- Tests: `server/test/loop/change-detection.test.ts` (new), `status.test.ts`, and a real-server `stalled` test in `server/test/api/tracer.test.ts`.

**Left, in order:**
1. Run `council-audit` (Claude seat only, other two `n/a`) on the diff against `wayfinder/v2-build-master`. Fix problems, up to five rounds.
2. Write `.plan/maps/v2-build/assets/070-change-detection-and-stalled-report.md` (decisions: stall counted per batch not per request, bridge error neutral and doesn't end the run, identification counts, box reads excluded, status event only on a stall flip, battle skip gated on `failingSince`, hash kept off on failed decodes). Run `unslop` on it.
3. Run the Timing close, delete this section, write `## Answer` and the Decisions line in the ticket, commit, push, open a PR against `wayfinder/v2-build-master` and link it, return DONE.

**Open council problems:** none yet. Last audit: none.

**Read first:** `server/src/loop/read-loop.ts`, `server/src/loop/stall.ts`, `server/test/loop/change-detection.test.ts`.

**Note:** `core.test.ts` fails on this machine because it runs Lua 5.5. It is unrelated to this ticket.
