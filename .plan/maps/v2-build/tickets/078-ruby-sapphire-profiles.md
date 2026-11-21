---
type: task
blocked_by: [063, 064, 065]
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T13:05:00Z
---

# Ruby and Sapphire profiles

## What to build

Add the English pokeruby builds (Ruby and Sapphire, with their revisions) to `generate:profiles`. Signatures use the two anchored words from [the 036 amendment](../assets/036-ruby-sapphire-signature-bytes.md), and the generator gains the anchored words with a size check. Ruby and Sapphire have no GF header, a static `gPokemonStorage` (spec §6.5) and, to be confirmed in pokeruby, no save encryption key. The `player`, `bag` and `battle` blocks come from pokeruby symbols. The same hash, provenance and evidence rules as the FireRed ticket apply.

## Acceptance criteria

- Every English Ruby and Sapphire revision pokeruby defines is generated or explicitly held back, with the reason in `SIGNATURE-EVIDENCE.md`.
- The anchored-word signature has a size check and a failing synthetic test.
- The decoders run on synthetic Ruby memory, including the static box address.
- No ROM bytes are committed.

## Resolution

Six profiles (`ruby-us-1.0`, `ruby-us-1.1`, `ruby-us-1.2`, `sapphire-us-1.0`, `sapphire-us-1.1`, `sapphire-us-1.2`) are generated from pokeruby symbols pinned at 78b19905 and SHA-1 files at 5784633c. Their signature is the two anchored words from the 036 amendment, and the generator's anchor check fails on a missing, repeated or wrong-size symbol. None is held back and all are rated `unconfirmed`. The per-game battle layout (in-battle byte, spikes offset, money multiplier, money entry size) lives in a new strict optional `constants` block with Emerald defaults, and `gBattleResources` is optional. Tests cover the generator on pokeruby excerpts, the read loop on synthetic Ruby memory including the static box address, and the four constants, and each was mutation-checked. The Claude council seat approved in round 1 (score 8; Gemini and GPT not run). Details are in [the decision report](../assets/078-ruby-sapphire-profiles-report.md).

Timing: wall 18m, active 17m, user 0s, wait 0s, blocked 0s | implement 14m, audit 2m (1 round) | tools 120 (3 subagent) | limits 0, compactions 0, handoffs 2 | ctx peak 159k | cost $4.33 sonnet-5-5 + $0.02 haiku-5-5
