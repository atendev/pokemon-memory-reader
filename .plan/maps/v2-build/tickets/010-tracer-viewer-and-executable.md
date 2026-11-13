---
type: task
blocked_by: [009]
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
