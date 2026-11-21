---
type: task
blocked_by: [087]
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T15:00:00Z
---

# Battle sprites and type icons on the Battle screen

## What to build

Add Pokémon sprites and type icons to the Battle screen from [Viewer Battle screen](./082-viewer-battle-screen.md), using the icon system from [Viewer icons and packs](./087-viewer-icons-and-packs.md). An unrevealed opponent battler still shows no species, level or moves anywhere in the DOM, and that includes its sprite, its alt text and its file name.

## Acceptance criteria

- Revealed battlers and the player's side show their sprite and type icons, and the screen falls back cleanly when an icon is missing.
- A component test checks that an unrevealed opponent battler renders no sprite, alt text or icon URL that names its species.
- The compile smoke still passes.

## Answer

No production code changed. Tickets 082 and 087 had already put sprites, type icons, item icons and the missing-icon fallback on the Battle screen, and the hidden battler card and tile render no art. This ticket adds seven component tests in `viewer/src/BattleScreen.test.tsx`. They cover found icons for revealed battlers and the player's side, the fallback tile and type dot when every URL fails, no image request with icons off or no game, and the unrevealed-opponent rule: no sprite, alt text, icon URL or type icon names its species, and `?showUnrevealed=1` is the only way the sprite appears. A mutation check that put species 150 art into the hidden card failed two tests. The compile smoke passes. [Report](../assets/098-viewer-battle-icons-report.md).

Timing: wall 2m, active 2m, user 0s, wait 0s, blocked 0s | implement 1m, audit 48s (1 round) | tools 26 (4 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 84k | cost $0.71 sonnet-5-5 + $0.01 haiku-5-5
