---
type: grilling
blocked_by: []
assets: []
---

# Read loop and latency budget

## Question

How often does the program read each resource from the adapter, how does it detect changes to push, and what is the latency budget from a game change to an SSE event?

Decide polling cadence per resource and per adapter, change detection (hash of raw bytes versus decoded compare), batching reads, behavior while the emulator is paused or fast-forwarded, and backpressure for slow clients. Events carry whole resources, per [API v2 contract](./006-api-contract.md).
