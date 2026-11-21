---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795285581
claimed_at: 2026-11-21T18:37:00Z
---

# Convert the viewer to Tailwind

## What to build

Surfaced by [Does `bun-plugin-tailwind` work under `--compile`?](./088-tailwind-under-compile-spike.md). The spike found that the plugin works through the `Bun.build` API with `compile` and not through the `bun build --compile` command line. Write a `Bun.build` build script and point `build:exe`, `ci.yml` (`compile-smoke` and `rehost-smoke`), `release.yml` and `docs/lgpl-relinking.md` at it. Add the plugin to the root and viewer `devDependencies`, port `styles.css` to Tailwind, and decide whether `EMBEDDED_DEV_PACKAGES` needs Tailwind's MIT banner. Read the spike note in `assets/088-tailwind-under-compile-spike.md` first.

## Acceptance criteria

- The compiled executable ships the processed Tailwind CSS on every CI target, and `scripts/smoke.ts` passes.
- `build:exe`, both CI smoke jobs, `release.yml` and `docs/lgpl-relinking.md` use the one build script.
- The third-party notices cover Tailwind if its license needs a banner, and the decision is in the report.
- The viewer looks the same as before, and its component tests pass.
