---
type: prototype
blocked_by: [003, 004, 006]
assets: []
---

# Viewer design

## Question

What screens and states does the new viewer show, which settings does it own, and what is its visual system (layout, components, styling on Tailwind)?

The viewer is the app's only GUI and is built from scratch. It must cover connection status, the detected game, adapter choice, and settings from the app form factor ticket, plus a readable view of the game state the API v2 contract exposes. Prototype the main screens to react to before deciding.

The License ticket rules out bundling Nintendo art, so decide where sprites come from: a user-set URL, a community CDN, or no sprites.
