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
