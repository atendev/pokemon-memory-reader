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

## Handoff

Branch `t3/ruby-sapphire-profiles`, base b253ec0. Audit round 0 (no council yet). No code written yet, research only.

Done: read the ticket, the 036 amendment, the FireRed commits (2cf210f, 8ed9317) as the model, and the generator and gen3 decoders. Every Ruby fact is in [the facts file](../assets/078-ruby-sapphire-profiles-facts.md), including six build names, SHA-1 files, symbol gaps, layout differences and the plan.

Left, in order:
1. Schema: optional `battle` layout values in the Gen 3 `constants` (`inBattleOffset`, `sideTimerSpikesOffset`, `moneyMultiplierOffset`, `trainerMoneyEntrySize`), defaults in `battle.ts` and `trainers.ts`. Make `gBattleResources` optional.
2. Generator: anchored signature words `{ at, value }` with the size check (failing synthetic test), local-symbol lookup for anchors, `count` override for the size-0 `gTrainerMoney`, `constants` field in `ProfileDefinition`.
3. `definitions.ts`: six pokeruby builds, `.sym` and `.sha1` excerpt fixtures under `scripts/generate-profiles/fixtures`, No-Intro DAT entries added to the excerpt. Run `bun run generate:profiles` (network works) and check a stable second run. Hold back any build with a broken chain, with the reason in `SIGNATURE-EVIDENCE.md`.
4. Tests: loop test on synthetic Ruby memory (static box at `gPokemonStorage`, money unXORed, party, player, bag), battle test with the Ruby offsets, generator tests. Fix any count tests (profile counts, notes, No-Intro entries).
5. Typecheck, lint, `bun test`. Council audit (Claude seat only), decision report to `assets/078-ruby-sapphire-profiles-report.md` with unslop, record the resolution, run the Timing close, commit, push, return DONE.

Read first: the facts file, `scripts/generate-profiles/{definition,definitions,build,sym,plan}.ts`, `server/src/format/gen3/{profile,battle,trainers}.ts`, `server/src/profile/schema.ts` (`member`), `server/test/loop/firered.test.ts`, `server/test/gen3/battle-firered.test.ts`.
