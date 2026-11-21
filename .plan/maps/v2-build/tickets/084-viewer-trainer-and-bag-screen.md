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
