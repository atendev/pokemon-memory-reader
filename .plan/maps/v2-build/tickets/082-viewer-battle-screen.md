---
type: task
blocked_by: [068, 081]
claimed_by: wfm-v2-build-master-1795256075
claimed_at: 2026-11-21T11:02:23Z
---

# Viewer Battle screen

## What to build

Spec §11.4. The Battle screen reads the `battle` resource, including the hidden opponent party (unrevealed mons stay hidden), the `field`, and `lastBattle` when inactive. It follows the spec's text for what shows and what stays hidden.

## Acceptance criteria

- Component tests render an inactive state with a `lastBattle`, a wild battle, a trainer battle with unrevealed mons, and a double battle.
- An unrevealed opponent mon shows no species, level or moves anywhere in the DOM.
- The screen runs against the fake bridge in the compiled executable.

## Resolution

`viewer/src/BattleScreen.tsx` and `battle.ts` render the `battle` resource: both sides' active battlers, the opponent party with `?` tiles for unrevealed mons, Pokémon left per trainer, field badges, and a `lastBattle` summary when inactive. "Show unrevealed opponent Pokémon" is off by default, stored in localStorage, with a `?showUnrevealed=1|0` override that never writes storage. An unrevealed opponent battler renders as a hidden card, and `isHiddenBattler` fails closed on a null `partySlot` or a missing party entry. 92 viewer tests cover the inactive, wild, trainer and double cases. `server/test/e2e/battle-executable.test.ts` runs a wild battle through the compiled executable on the fake bridge, with a step in the compile-smoke job of `ci.yml`. Report: [082 report](../assets/082-viewer-battle-screen-report.md). Claude seat only, approved in round 3 at 8. Gemini and GPT seats skipped (out of quota).

Timing: wall 10m, active 9m, user 0s, wait 0s, blocked 0s | implement 5m, audit 3m (3 rounds), fix 31s, gate 36s | tools 93 (15 subagent) | limits 0, compactions 0, handoffs 1 | ctx peak 153k | cost $2.94 sonnet-5-5 + $0.04 haiku-5-5
