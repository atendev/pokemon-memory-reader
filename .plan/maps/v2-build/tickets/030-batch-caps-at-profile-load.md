---
type: task
blocked_by: [006]
claimed_by: wayfinder-master v2-build-master-1794792924
claimed_at: 2026-11-16T03:56:33Z
---

# Check batch caps at profile load

## Question

[How is RetroArch probed, and what happens when a batch is too big?](./026-retroarch-probe-and-batch-caps.md) says bridge caps are checked at profile load and never split at run time. [Emerald profile and generator](./005-emerald-profile-and-generator.md) left this out of `loadProfiles` because no ranges or `BRIDGE_CAPS` existed. [Bridge protocol core](./006-bridge-protocol-core.md) now defines the 64 KiB cap. Add the load-time check against each bridge's cap.

## Acceptance

- A profile whose region batch exceeds a bridge's cap fails to load with a message naming the region and the cap.
- The Emerald profile passes the check.
