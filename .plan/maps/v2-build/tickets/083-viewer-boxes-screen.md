---
type: task
blocked_by: [066, 081]
claimed_by: wfm-v2-build-master-1795260524
claimed_at: 2026-11-21T11:50:18Z
---

# Viewer Boxes screen

## What to build

Spec §11.5. The Boxes screen reads `boxes` and shows each box with its name, wallpaper index where known, unreadable boxes, and corrupt slots as distinct from empty ones. The Gen 1-2 staleness note from §7.9 shows where it applies.

## Acceptance criteria

- Component tests cover empty slots, corrupt slots, an unreadable box and a null name.
- The screen loads one box at a time through `/boxes/:n` or the whole resource, as the spec says.
- It runs against the fake bridge in the compiled executable.
