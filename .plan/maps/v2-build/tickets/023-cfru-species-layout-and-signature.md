---
type: grilling
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794843940
claimed_at: 2026-11-17T14:11:18Z
---

# How is the species-info layout confirmed, and does the signature still catch CFRU builds without DPE?

## Question

Spec §17 item 11. Decide how the 0x1C species-info stride is confirmed when fixtures can't hold ROM bytes, whether that gates the Gen 3 `supported` flag or only hack species-table reading, and whether the vanilla signature still guards CFRU builds made without DPE.

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

The [023 amendment](../assets/023-cfru-species-layout-and-signature.md) settles it. Decided in auto mode on 2026-11-17, council APPROVE in round 3. [Report](../assets/023-cfru-species-layout-and-signature-report.md).

- **Vanilla stride.** `generate:profiles` checks that each pret repo's species-info symbol size equals the species count times `0x1C`, and the run fails otherwise. Emerald's sym gives `0x2D10` for 412 species. No ROM bytes are needed. Building it is [ticket 059](./059-generator-species-info-stride-check.md).
- **CFRU stride.** A `test:local` check on the owner's CFRU ROM must find each built-in hack profile's `info` table valid at `0x1C` and invalid at `0x1A` and `0x1E`. `find-rom-tables` measures the stride and refuses a CFRU fragment that isn't `0x1C`.
- **What it gates.** Hack species-table reading only. Official profiles never read `info` from ROM, and ROM-derived fields never reach a `verified` list, so no data format's `supported` flag changes. Built-in hack profiles with an `info` table need a passing ledger row from `test:local --record`, and `release-gate.test.ts` enforces that. Failure rows block them as in ticket 055.
- **Signature.** It stays unchanged. CFRU at the pinned commit repoints `gBattleMoves` unconditionally, so the vanilla signature fails on builds without DPE through `0x1CC`, and DPE builds also fail `0x1BC`. The same ledger row asserts that the base profile's signature fails on each shipped hack.
- **Excluded:** gating `supported`, a `stride` profile field, an entry-0 rule, and adding the `0x1C0` word to the signature.
