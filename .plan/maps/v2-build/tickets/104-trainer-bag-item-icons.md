---
type: task
blocked_by: [087]
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T15:00:00Z
---

# Item icons on the Trainer and bag screen

## What to build

[Viewer Trainer and bag screen](./084-viewer-trainer-and-bag-screen.md) shows items as names and `#<id>` fallbacks. Once [viewer icons and packs](./087-viewer-icons-and-packs.md) lands, show each item's icon beside its name, with the name still shown as text and a missing icon falling back to the plain row.

## Acceptance criteria

- Component tests cover an item with an icon, a missing icon and an unknown item.
- The screen still passes its existing component tests and the compiled-executable test.

Timing: wall 1m, active 1m, user 0s, wait 0s, blocked 0s | implement 43s | tools 19 (2 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 70k | cost $0.51 sonnet-5-5 + $0.01 haiku-5-5

## Answer

Each bag item on the Trainer & bag screen now renders through `ItemArt`, so its icon shows beside the name, the name stays text, and a missing icon, an unknown item or no icon provider falls back to the plain name or `#<id>` row with no layout shift. No new wiring or CSS was needed. Component tests cover an icon, a missing icon, an unknown item and no icon settings. Council: Claude seat only, APPROVE 8 in round 1, Gemini and GPT not run. Report: [104 report](../assets/104-trainer-bag-item-icons-report.md).
