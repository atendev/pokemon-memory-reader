---
type: grilling
blocked_by: []
assets: []
---

# API v2 contract

## Question

What does the v2 API look like to an overlay or tracker?

Decide polling vs push (WebSocket or SSE), how clients learn which game and generation is running, how fields that differ by generation are represented (DVs vs IVs, abilities, natures), the resource list (party, player, bag, battle, boxes), versioning, and the error shape when no game or adapter is connected.

Input from [Game profile source and format](./005-game-profile-source.md): profiles have stable IDs such as `firered-us-1.0` and `radical-red-4.1`. Decide whether the API exposes them.
