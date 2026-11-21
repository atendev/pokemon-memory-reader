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
