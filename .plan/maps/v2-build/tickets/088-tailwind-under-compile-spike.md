---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795285581
claimed_at: 2026-11-21T18:27:28Z
---

# Does `bun-plugin-tailwind` work under `--compile`?

## What to build

Spec §15 and the map's viewer fog. The tracer viewer uses plain CSS because `bun-plugin-tailwind` was unproven under `bun build --compile`. Build the tracer viewer with the plugin into the compiled executable on Linux, run `scripts/smoke.ts`, and record whether the styles reach the executable and whether the Windows and macOS targets are likely to behave the same (CI builds them). Write the result as a short note in the map's assets, with the spec's fallback if it fails. Don't convert the viewer in this ticket.

## Acceptance criteria

- A note in `assets/` says yes or no with the command, the version of the plugin and the Bun pin used.
- If yes, the next ticket (converting the viewer) is named in the note and added to the map. If no, the plain-CSS fallback is confirmed.
- The branch is left with no half-converted files.

## Resolution

Yes, through the `Bun.build` API, and no through the `bun build --compile` command line. With `plugins: [tailwind]` and a `compile` option, `bun-plugin-tailwind` 0.1.2 on Bun 1.4.2 ships processed CSS in the linux-x64 executable and `scripts/smoke.ts` passes. The command line with the plugin set in `bunfig.toml` ships raw `@theme` and `@tailwind`. Windows, macOS and linux-arm64 builds hold the same processed CSS but were not run. The conversion ticket must move `build:exe`, `ci.yml`, `release.yml` and `docs/lgpl-relinking.md` onto a build script, and `tailwindcss` itself isn't needed. Details and the build script are in [the note](../assets/088-tailwind-under-compile-spike.md). Next: convert the viewer to Tailwind (surfaced). [Report](../assets/088-tailwind-under-compile-spike-report.md).

Timing: wall 4m, active 4m, user 0s, wait 0s, blocked 0s | implement 2m, audit 1m (2 rounds) | tools 34 (4 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 112k | cost $1.20 sonnet-5-5 + $0.01 haiku-5-5
