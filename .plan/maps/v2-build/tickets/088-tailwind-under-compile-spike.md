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
