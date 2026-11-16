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

## Resolution

`loadProfiles` now measures each resolved profile's main batch and box request against the bridge caps (512 ranges, 64 KiB, merge gap 32) in `server/src/profile/caps.ts`. A profile over a cap fails to load, and the message names the request, its totals, both caps and the largest region, for example `main batch needs 2 ranges and up to 633 bytes, over the bridge cap of 512 ranges and 65536 bytes (largest region party.party, 600 bytes)`. A failing user replacement is skipped and the built-in kept. The decoders' reads come from a new `declaredRegions` in `server/src/format/registry.ts`, which needs no reference data. The box request is empty until a format has a box decoder. A pointer target over the byte cap counts in full, because its domain is unknown until read time. `LoadInput` takes an optional `caps` so tests can lower them. Tests cover 512 and 513 ranges, 65536 and 65537 bytes, pointer words, the rom exclusion, an over-cap built-in and Emerald passing. Audit approved in round 2, CI green on 6b299ca (run 43801469875). The decision report is `../assets/030-batch-caps-at-profile-load-report.md`.
