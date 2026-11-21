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

## Handoff

Branch `t3/firered-leafgreen-profiles`, audit round 0 (no council run yet). Final SHA is in the HANDOFF report.

**Done**
- `scripts/generate-profiles/definitions.ts`: `pokefirered()` helper and four definitions (`firered-us-1.0`, `firered-us-1.1`, `leafgreen-us-1.0`, `leafgreen-us-1.1`). Symbols pinned to pokefirered `symbols` 3b401eaf, SHA-1 files to master ce6406d8. All four SHA-1s have No-Intro entries, so nothing is held back. `GF_SIGNATURE` (renamed from `EMERALD_SIGNATURE`) is shared, since `sGFRomHeader` is at 0x08000100 with the same field order. `NO_INTRO_GBA` is shared.
- FireRed values confirmed in pokefirered source: money 0x290, flags 0xEE0, key at SaveBlock2 0xF20 (money and bag XORed), badge flags 0x820-0x827, bag pockets 0x310/0x3B8/0x430/0x464/0x54C with capacities 42/30/13/58/43. Trainer, class-name and money tables are 40/13/2 bytes. `moneyMultiplier` stays at BattleStruct 0x4A. `BattlePokemon`, `MapHeader`, weather, side bits, `inBattle` and `PokemonStorage` match Emerald.
- `server/src/format/gen3/profile.ts`: `gTrainerBattleOpponent_B` is optional (FireRed has no such symbol). `battle.ts`: `twoOpponents` needs that address, and opponentB falls back to A. Bit 15 is `BATTLE_TYPE_GHOST` in pokefirered.
- `bun run generate:profiles` ran, outputs are in `server/src/profile/builtin/` and a second run is identical.
- New `server/test/loop/firered.test.ts` (synthetic FireRed memory through the read loop for all four builds): 8 pass, 13 fail, not yet fixed.

**Left, in order**
1. Fix `firered.test.ts`. Known: `Player.section` is `{ id, name }` (compare `.id`), `playTime.frames` exists (use `toMatchObject` fields), and check the Status, Party, Bag and Boxes shapes against `@pokemon-memory-reader/api/schemas`. Run `bun test server/test/loop/firered.test.ts` for the rest.
2. Add generator tests: `build.test.ts` and `plan.test.ts` (pokefirered excerpt `.sym` and sha1 fixtures under `scripts/generate-profiles/fixtures/`, plus a stride test). Add FireRed trainer, battle and optional-B unit tests.
3. Run the whole `bun test`, `bun run typecheck` and `bun run lint`. Known unrelated failure: Lua 5.5 check in `server/test/bridge/core.test.ts`.
4. Run `council-audit` with the Claude seat only (Gemini and GPT `n/a`). Max five rounds.
5. Write `.plan/maps/v2-build/assets/077-firered-leafgreen-profiles-report.md`, run unslop on it, run the Timing close, commit, push, and return DONE.

**Surfaced tickets to return**
- Gen 3 item names per profile: `gen3-en.json` items come from pokeemerald, so FireRed and LeafGreen key items and TMs show wrong or null names.
- FireRed battle verification on a real game, covering type flag bits 16 to 19, money formula and tableless types.

**Read first:** `scripts/generate-profiles/definitions.ts`, `server/test/loop/firered.test.ts`, `server/src/format/gen3/battle.ts` (lines 165-175, 296-302).
