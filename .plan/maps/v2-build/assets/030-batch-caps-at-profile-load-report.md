# Check batch caps at profile load: decision report

Ticket: [Check batch caps at profile load](../tickets/030-batch-caps-at-profile-load.md). Rules come from amendment 026 point 6.

## Decisions

| # | Question | Options | Choice | Made by | Audit |
|---|----------|---------|--------|---------|-------|
| 1 | Where does the check run? | In `loadProfiles` after the full-schema parse, or in a separate pass | Inside `finish()` in `server/src/profile/registry.ts`, right after `profileFull` parses. A replacement that fails is skipped with the built-in kept, and a failing built-in or user-only profile lands in `problems`. This follows 018's resolved-profile rule. | Implementer | Approved in round 1 |
| 2 | How does the check learn what a profile reads? | Use `bindGame`, or add a lookup that skips reference data | New `declaredRegions(profile)` in `server/src/format/registry.ts`. `bindGame` returns no parts when the language has no reference data, which would let an over-cap profile load. `declaredRegions` returns `{ main, boxes }` straight from the decoders' `regions()`. | Implementer | Approved in round 1 |
| 3 | What goes in the box request? | Invent a box shape, or leave it empty | Empty. No format has a box decoder yet. `declaredRegions` already splits `boxes` out, and `loadProfiles` measures it with the same rule, so a box decoder is checked once it exists. | Implementer | Approved in round 1 |
| 4 | How are range count and bytes measured? | Merged plan, or amendment 026's unmerged bound | The amendment's bound. Count is the unmerged count. Bytes are the sum of lengths plus `mergeGap` times (count - 1). A pointer region adds two ranges, the pointer word at its width and the target at its declared length. | Implementer, from amendment 026 | Arithmetic re-derived by auditor |
| 5 | What happens to a `rom` range over the caps? | Leave it out, or count it | A static `rom` range longer than 65536 bytes is left out, as the amendment says. A range of exactly 65536 counts. | Implementer, from amendment 026 | Approved |
| 6 | Does a pointer target over the cap count as rom and get left out? | Leave out, or count | Count it. The target's domain is unknown until read time, so counting is the safe choice. A pointer into rom over 64 KiB would fail to load where the amendment would leave it out. No decoder declares one. | Implementer | Auditor raised it in round 1 and accepted it in round 2 as a known residual risk |
| 7 | How do tests lower the caps? | Hardcode large fixtures, or inject caps | Optional `caps` on `LoadInput`, defaulting to `BRIDGE_CAPS`. Gen 3 party regions are fixed at 600 bytes, so a test can't build an over-cap profile without it. | Implementer | Approved |
| 8 | What does the error say? | Region only, or the amendment's request, totals and caps | `main batch needs 2 ranges and up to 633 bytes, over the bridge cap of 512 ranges and 65536 bytes (largest region party.party, 600 bytes)`. It names the request, totals, both caps and the largest region, which covers the ticket's "naming the region and the cap". | Implementer | Approved |
| 9 | Does the Emerald test prove the check ran? | Assert no problems only, or also assert what was measured | Both. The test asserts `declaredRegions` returns the `party` part and that it fits the caps, so a decoder lookup that returns nothing can't pass it. | Auditor found it in round 1. Implementer fixed it. | Approved in round 2 |

## Verification

- `bun run lint`, `bun run typecheck` and `bun test server/src/profile` pass. The full `bun test` has one failure, the "Lua 5.3 or 5.4" test, because this machine has Lua 5.5. CI pins 5.3 and 5.4, and the test fails the same way without this change.
- New tests in `caps.test.ts` cover 512 and 513 ranges, 65536 and 65537 bytes, the pointer word plus target, and the `rom` exclusion. `registry.test.ts` covers an over-cap built-in failing to load with the region and cap named, and Emerald passing at the real caps.

## Audit

Round 1: two problems, the pointer-target rom question (kept, with a comment) and a weak Emerald test (fixed). Round 2: APPROVE.

The decoder-fit test that [mGBA bridge and adapter](../tickets/007-mgba-bridge-and-adapter.md) left to this ticket is covered. Every built-in profile runs through the same check on load, and `builtin.test.ts` already requires zero problems.
