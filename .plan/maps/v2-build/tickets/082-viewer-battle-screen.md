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
