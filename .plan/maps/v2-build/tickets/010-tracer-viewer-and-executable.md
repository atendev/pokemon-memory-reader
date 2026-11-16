---
type: task
blocked_by: [009]
claimed_by: wayfinder-master v2-build-master-1794792924
claimed_at: 2026-11-16T03:24:12Z
---

# Tracer viewer and executable

## Question

Ship the tracer as one compiled executable that serves a minimal viewer. Follow the viewer and release pipeline sections of the spec.

- A React viewer built by Bun with a single Party screen. It reads `/api/v2/party` and `status` through the API package's client and shows six cards with name fallbacks, no icons. It applies the `apple` skill's sizing rules where the viewer design leaves them open.
- The viewer is embedded in the server, and `bun build --compile` produces the executable.
- `scripts/smoke.ts` (version check, starts, serves `status`) runs in CI against a linux-x64 build. Turn on the compile smoke job in `ci.yml`.
- The executable writes the mGBA bridge into the data folder and serves it at `/bridges/mgba.lua`.

## Acceptance

- The CI compile smoke is green.
- Running the executable locally serves the viewer, which shows the no-game state.

## Resolution

The tracer ships as one executable built with `bun build --compile`. It serves a React viewer with one Party screen, which reads `status` and `party` through the API package's client, shows six cards with name fallbacks and no icons, and shows an empty state when no game is loaded. It writes the mGBA bridge into the data folder and serves it at `/bridges/mgba.lua`. `scripts/smoke.ts` checks the version, startup, `status` as `disconnected`, the viewer HTML and its assets, the bridge, and a SIGTERM exit of 0. The compile-smoke job in `ci.yml` is on. Decisions: plain CSS (Tailwind deferred), a 1 s poll until SSE, mGBA fixed at 127.0.0.1:7426 until the config tickets, no `config.json` yet, and only the `mgba` bridge because `bizhawk.lua` doesn't exist. Audit approved in round 2, CI green on 929c865 (PR 11). The decision report is `../assets/010-tracer-viewer-and-executable-report.md`. No browser has executed the viewer bundle yet.
