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

## Answer

`viewer/src/BoxesScreen.tsx` and `boxes.ts` render the `boxes` resource: a box selector (name, "(current)", "(unreadable)"), the wallpaper index where known, a 5×4 or 6×5 grid in slot order, a distinct red marker for corrupt slots against a dashed "Empty" for empty ones, a note in place of the grid for an unreadable box, and the Gen 1-2 staleness note. Clicking a mon opens the existing party card, which shows null fields as `—`. The screen loads the whole resource through `useBoxes`, which polls once a second and runs only while the Boxes route is open in a game, because SSE has not landed. `battle-executable.test.ts` now also checks `GET /boxes` and `/boxes/1` on the compiled executable against synthetic Gen 3 storage. Slots show text, with no icons, until the icon ticket lands. Audit: Claude seat APPROVE 8 at round 1, other seats n/a. Report: [assets/083-viewer-boxes-screen-report.md](../assets/083-viewer-boxes-screen-report.md).

Timing: wall 4m, active 4m, user 0s, wait 0s, blocked 0s | implement 2m, audit 1m (1 round) | tools 41 (2 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 110k | cost $1.33 sonnet-5-5 + $0.01 haiku-5-5
