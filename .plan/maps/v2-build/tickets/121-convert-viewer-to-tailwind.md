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

## Answer

`scripts/build-exe.ts` calls `Bun.build` with `bun-plugin-tailwind` and takes `--outfile`, `--target`, `--compile-executable-path`, `--label` and `--commit`. `build:exe`, both CI smoke jobs, `release.yml` and `docs/lgpl-relinking.md` use it. `styles.css` keeps its component rules in `@layer components`, with the tokens in `@theme` and only Tailwind's theme and utilities layers imported, so the look is unchanged. `tailwindcss` is pinned to 4.1.14 beside the plugin, and `bunfig.toml` loads the plugin for dev serving. Its MIT license needs more than the output banner, so `EMBEDDED_DEV_PACKAGES` lists `tailwindcss` and the notices file carries the text. `scripts/smoke.ts` fails on a stylesheet with raw Tailwind directives. Audit: Claude seat APPROVE at round 2 (8), Gemini and GPT not run. Report: [121 report](../assets/121-convert-viewer-to-tailwind-report.md).

Timing: wall 6m, active 6m, user 0s, wait 0s, blocked 0s | implement 3m, audit 2m (2 rounds) | tools 51 (8 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 108k | cost $1.37 sonnet-5-5 + $0.02 haiku-5-5
