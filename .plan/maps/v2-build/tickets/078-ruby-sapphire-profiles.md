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

Branch `t3/ruby-sapphire-profiles-2` (from `1cadcdf`), base b253ec0. Audit round 0 (no council yet). Facts: [the facts file](../assets/078-ruby-sapphire-profiles-facts.md).

Done and passing (typecheck, biome ci, `bun test` 1425 pass; the one failure, "Lua core runs under Lua 5.3 or 5.4", is this machine's Lua 5.5.1, not the change):
- Schema: `gen3Constants` (strict optional `inBattleOffset`, `sideTimerSpikesOffset`, `moneyMultiplierOffset`, `trainerMoneyEntrySize`) and `GEN3_CONSTANT_DEFAULTS` in `format/gen3/profile.ts`, `member()` takes a constants schema, `gBattleResources` optional. `battle.ts` and `trainers.ts` read them.
- Generator: `SignatureWord { at, value }`, `requireAnchor` (size and once-only check), `parseLocalSymbols`, table `count` override, `constants` in the definition, `locals` through `plan.ts` and `main.ts`. Emerald and FireRed JSON unchanged.
- Six pokeruby definitions, fixtures (excerpt `.sym`, `.rom.sha1`, DAT excerpt), generated six profiles and the evidence notes. All six chains intact, none held back. Second run stable.
- Tests: `build.test.ts` and `plan.test.ts` (anchor size failure, count override, committed files), `loop/ruby.test.ts`, `gen3/battle-ruby.test.ts`.

Left, in order:
1. Mutation-check the new tests (break one signature byte, the `inBattleOffset`, the money entry size) to see each fail. Optionally add a schema test that `constants` rejects unknown keys.
2. Add a Ruby line to `SIGNATURE-EVIDENCE.md` reasoning: none held back, all `unconfirmed`. Check `CONTEXT.md` Signature entry needs no change.
3. Council audit, Claude seat only, "Gemini and GPT: not run". Fix problems, up to five rounds.
4. Decision report `assets/078-ruby-sapphire-profiles-report.md` with unslop, record the resolution (delete this section), Decisions line, Timing close, commit, push without force, open PR against `wayfinder/v2-build-master` and link it, return DONE.

Read first: the Done list's files above and `git diff b253ec0 --stat`.
