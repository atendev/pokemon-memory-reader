---
type: grilling
blocked_by: [011]
assets: []
---

# Battle tracker data model

## Question

What is the shape of the `battle` resource and when does it flip between `{ active: false }` and active data?

Builds on [What battle state is readable](./011-battle-state-readability.md) and the `battle` resource in [API v2 contract](./006-api-contract.md). Decide the fields, how unknown or unreadable values are marked, and what the viewer's Battle screen shows when only part of the data exists, as in [Viewer design](./008-viewer-design.md).
