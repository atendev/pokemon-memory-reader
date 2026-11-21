---
type: task
blocked_by: [063, 064, 081]
claimed_by: wfm-v2-build-master-1795260524
claimed_at: 2026-11-21T12:05:00Z
---

# Viewer Trainer and bag screen

## What to build

Spec §11.6. The Trainer and bag screen reads `player` and `bag`: name, IDs, money, badges (8, or 16 in Gen 2), location, play time, and the pockets with their capacity and item quantities. A null `secretId` or `name` is hidden, not shown as text.

## Acceptance criteria

- Component tests cover badges obtained and not, an empty pocket, a full pocket and an unknown item name.
- Play time and location render from the 017 shapes.
- It runs against the fake bridge in the compiled executable.

Timing: wall 4m, active 4m, user 0s, wait 0s, blocked 0s | implement 3m, audit 1m (1 round) | tools 45 (2 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 129k | cost $1.48 sonnet-5-5 + $0.01 haiku-5-5

## Answer

`viewer/src/TrainerScreen.tsx` and `trainer.ts` render the `player` and `bag` resources. The trainer card shows name, trainer and secret ID, money, play time (`hours:mm:ss`), the area name and the raw map. A null or empty name and a null secret ID render nothing. Badges sit in rows of eight with an obtained or "Not yet" word on each, and a sixteen-badge Gen 2 player gets Johto and Kanto rows. Each bag pocket is a card with `used / capacity`, an "Empty" line when it holds nothing, a "Full" flag when every slot is used, and `#<id>` for an item the name table lacks. The two resources load and fail separately, and both poll only while the route is open in a game. `battle-executable.test.ts` now serves a synthetic player and bag from the fake bridge to the compiled executable (the box block moved to `0x37400`, clear of `gMapHeader`). Item icons wait on the icon system. Audit: APPROVE at round 1, Claude seat 8, Gemini and GPT n/a. [Report](../assets/084-viewer-trainer-and-bag-screen-report.md).
