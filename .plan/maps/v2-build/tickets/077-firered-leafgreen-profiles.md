---
type: task
blocked_by: [063, 064, 065]
---

# FireRed and LeafGreen profiles

## What to build

Add the English pokefirered builds (FireRed and LeafGreen, 1.0 and 1.1) to `generate:profiles`, following spec §5.3 and §5.4 and the Emerald profile as the model. Each definition pins a pret commit, takes SHA-1 from pret and CRC32 from No-Intro ([generate hash lists](./029-generate-hash-lists.md)), runs the species-info stride check ([059](./059-generator-species-info-stride-check.md)) and writes provenance with `signatureEvidence` from the ledger ([037](./037-signature-evidence-ledger.md)). FireRed uses the `gPokemonStoragePtr` pointer entry for boxes (spec §6.5), and the `player`, `bag` and `battle` blocks come from pokefirered symbols. Location names key by art version ([034](./034-gen3-location-names.md)). Differences from Emerald, such as the save block layout and whether money and quantities are XORed, are confirmed in pokefirered, not assumed.

## Acceptance criteria

- Four profiles are generated and load, each within the batch caps, with a stable second run.
- The decoders for party, player, bag and boxes run on synthetic FireRed memory, and any build that can't be checked against a ROM is rated by the signature evidence ledger.
- The generator holds back any revision whose chain is broken, as 037 does, without failing the run.
- No ROM bytes are committed.
