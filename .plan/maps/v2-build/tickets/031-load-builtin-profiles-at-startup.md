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

## Resolution

Server startup now loads the built-in profiles through `loadStartupProfiles` (`server/src/profile/startup.ts`). A built-in profile that fails to load returns a message that lists each `builtin:<id>` path and reason. `main.ts` prints it to stderr and exits 1 before the bridges are generated. User profile problems are logged as warnings, and `main.ts` still passes no user profiles. On success it prints a `Profiles: emerald-us-1.0` line. Unit tests cover the registry holding `emerald-us-1.0`, a bad built-in `dataFormat`, a missing fixture and a bad user profile. A subprocess test starts the real `main.ts` and reads the `Profiles:` line. The print-and-exit branch in `main.ts` has no test of its own, because `main.ts` has no injection point. Audit approved in round 2, CI green on e4f2de9 (PR 12). The decision report is `../assets/031-load-builtin-profiles-at-startup-report.md`.
