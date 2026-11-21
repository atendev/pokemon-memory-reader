---
type: task
blocked_by: [063, 064, 065]
claimed_by: wfm-v2-build-master-1795260524
claimed_at: 2026-11-21T11:50:18Z
---

# FireRed and LeafGreen profiles

## What to build

Add the English pokefirered builds (FireRed and LeafGreen, 1.0 and 1.1) to `generate:profiles`, following spec §5.3 and §5.4 and the Emerald profile as the model. Each definition pins a pret commit, takes SHA-1 from pret and CRC32 from No-Intro ([generate hash lists](./029-generate-hash-lists.md)), runs the species-info stride check ([059](./059-generator-species-info-stride-check.md)) and writes provenance with `signatureEvidence` from the ledger ([037](./037-signature-evidence-ledger.md)). FireRed uses the `gPokemonStoragePtr` pointer entry for boxes (spec §6.5), and the `player`, `bag` and `battle` blocks come from pokefirered symbols. Location names key by art version ([034](./034-gen3-location-names.md)). Differences from Emerald, such as the save block layout and whether money and quantities are XORed, are confirmed in pokefirered, not assumed.

## Acceptance criteria

- Four profiles are generated and load, each within the batch caps, with a stable second run.
- The decoders for party, player, bag and boxes run on synthetic FireRed memory, and any build that can't be checked against a ROM is rated by the signature evidence ledger.
- The generator holds back any revision whose chain is broken, as 037 does, without failing the run.
- No ROM bytes are committed.

Timing: wall 11m, active 11m, user 0s, wait 0s, blocked 0s | implement 8m, audit 2m (2 rounds) | tools 113 (4 subagent) | limits 0, compactions 0, handoffs 1 | ctx peak 157k | cost $3.59 sonnet-5-5 + $0.02 haiku-5-5

## Resolution

Four profiles (`firered-us-1.0`, `firered-us-1.1`, `leafgreen-us-1.0`, `leafgreen-us-1.1`) are generated from pokefirered symbols pinned at 3b401eaf and SHA-1 files at ce6406d8. All four pret SHA-1s have No-Intro entries, so none is held back. All are rated `unconfirmed`. `gTrainerBattleOpponent_B` is now optional, because pokefirered has no such symbol and bit 15 is `BATTLE_TYPE_GHOST` there. Tests cover the read loop on synthetic FireRed memory, the generator on real pokefirered excerpts, and the held-back path. The Claude council seat approved in round 2 (score 8). Details are in [the decision report](../assets/077-firered-leafgreen-profiles-report.md).
