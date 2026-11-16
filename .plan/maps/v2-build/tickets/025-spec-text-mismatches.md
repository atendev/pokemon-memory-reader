---
type: grilling
blocked_by: []
assets: [../assets/025-spec-text-mismatches.md, ../assets/025-spec-text-mismatches-report.md]
claimed_by: wayfinder-master v2-build-master-1794792924
claimed_at: 2026-11-16T01:36:35Z
---

# Do these text mismatches read the way the spec shows them?

## Question

Spec §17 item 13. Confirm or change each low-weight mismatch it lists: official profiles reading from ROM, how the battle warning and the 2 s read-failure warning combine, the `status.game.signature` values, the Gen 1 end-marker fallback, and box cadence and caps from the PC box reading ticket.

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

The [amendment](../assets/025-spec-text-mismatches.md) confirms or changes each mismatch. Decided in auto mode, and the audit approved in round 2.

- Official profiles read no names from ROM. They read the header, the signature words and the trainer tables. An adapter that can't read ROM leaves trainer-table fields null and the signature `"unchecked"`.
- The two battle warnings become one rule. The program warns once the in-battle flag has stayed set with failing validation for 2 s of consecutive reads, at most once per flag-set period. Failures still feed the `/debug/metrics` counter, and public `status` gains nothing.
- `status.game.signature` is `"match" | "mismatch" | "unchecked" | null`, as ticket 023 and §5.4 have it.
- Gen 1 `wIsInBattle == 0xFF` always ends the battle, with outcome `unknown` until the Gen 1 `0xFF` sequence fixture (§12.5), captured after a known loss, confirms `lost`. §12.7 gains a marker gate, and its Gen 1-2 `wBattleResult` gate splits into one per data format.
- Tickets 018 and 022 replace ticket 013's box text. Boxes follow §8.3 (at most once per 1000 ms) and the §4.4 caps, checked at profile load per ticket 026.

Why: each choice reuses a rule the spec already has, or ties an unverified value to a real fixture. Excluded: official profiles reading no ROM at all, two independent warnings, a new status field, a three-value signature enum, mapping `0xFF` to `lost` before a fixture, a joint Gen 1-2 fallback switch, and ticket 013's 2 s cadence and GDB-stub chunking.
