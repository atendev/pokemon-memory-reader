---
type: task
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794792924
claimed_at: 2026-11-16T03:41:12Z
---

# Load built-in profiles at server startup

## Question

[Emerald profile and generator](./005-emerald-profile-and-generator.md) built the registry loader, but the server has no startup code yet, so nothing calls it. Add the server entry point's profile load step, per interfaces 004. A built-in profile that fails to load stops startup with a clear error. User profiles stay out of scope.

## Acceptance

- Starting the server loads `emerald-us-1.0` into the registry, shown by a test.
- A broken built-in profile fails startup in a test.
