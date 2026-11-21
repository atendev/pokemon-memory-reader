---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795256075
claimed_at: 2026-11-21T10:15:08Z
---

# Pointer-derived regions in the read loop

## What to build

Spec §8.5, on top of [Profile address notation](./013-profile-address-notation.md). Emerald's save data lives behind pointers (`gSaveBlock1Ptr`, `gSaveBlock2Ptr`, `gPokemonStoragePtr`), so the player, bag and box tickets can't read anything until the loop can plan a region from a pointer value. `plan.ts` carries a comment that this second phase isn't built.

Each batch reads the pointer words and addresses pointer-derived regions with the pointer values the previous batch read. If a pointer word changed, results that used it are dropped for that cycle and the next cycle reads the new address. When no pointer value is known (attach, game change, cold read), the cycle sends two requests in sequence: pointer words only, then the regions at those pointers plus the pointer words again, and the second reply is the sample. Steady-state cycles send one request. A pointer value of 0 is null, and a bad pointer fails only the decoders that use it that cycle (decision of Profile address notation).

## Acceptance criteria

- The planner and the loop implement the two-request attach and the one-request steady state, with the changed-pointer drop rule.
- Tests with the in-memory adapter and a synthetic memory move a pointer between cycles and check that stale results are dropped, a null pointer fails only its decoders, and other resources still decode.
- Box requests use the same rule with their own pointer, and the planner exposes a way for the box ticket to ask for it.
- The comment in `plan.ts` and the marked slot in `read-loop.ts` are replaced by the real code.
