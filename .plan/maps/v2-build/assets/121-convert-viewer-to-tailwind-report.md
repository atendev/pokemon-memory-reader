# Decision report: Convert the viewer to Tailwind

Branch `t3/convert-viewer-tailwind`. Audit: council single mode (Claude seat), approved in round 2 with a score of 8 in both rounds.

## Decisions

1. **One build script for every compile.**
   - Question: how do the CI jobs, the release workflow and `build:exe` run a plugin-aware build?
   - Options: a `Bun.build` script at the repo root, or one inside `viewer/`.
   - Choice: `scripts/build-exe.ts`, run with `bun scripts/build-exe.ts --outfile <path> [--target T | --compile-executable-path P] [--label L] [--commit SHA]`. It passes `bun-plugin-tailwind` to `Bun.build` and maps the flags to `compile` and `define`. It refuses `--target` together with `--compile-executable-path`. The spike failed from the repo root only because the plugin was a viewer-only dependency. With the plugin in the root `devDependencies` too, the root script resolves it.
   - Made by: implementer, from the spike note. Audit: approved.
2. **Callers.** `build:exe`, `ci.yml` (`compile-smoke` and `rehost-smoke`), `release.yml` and `docs/lgpl-relinking.md` all call the script. The doc now tells a relinker to use the script and explains that Bun's command line ignores plugins. `release-workflow.test.ts` looks for the script name instead of `bun build --compile`. Stale comments in `server/src/build-info.ts`, `server/src/notices.ts` and `scripts/release-archive.ts` were updated.
3. **How far to port `styles.css`.**
   - Question: rewrite 1,000 lines into utility classes in about 25 components, or move the sheet onto Tailwind's layers.
   - Options: full utility rewrite, or keep the component rules and move tokens and layers.
   - Choice: keep the rules. The tokens moved into `@theme` as `--color-*` and `--font-sans`, so `bg-surface`, `text-label-2` and similar utilities exist. The component rules sit in `@layer components`, and only Tailwind's `theme.css` and `utilities.css` are imported. Preflight is not imported, because it resets headings, buttons and images and would change the look the ticket says must stay the same.
   - Made by: implementer. Audit: approved. Declined as a follow-up: converting individual components to utility classes. It can happen screen by screen, now that utilities work.
4. **`tailwindcss` package.** `@import "tailwindcss/theme.css"` does not resolve without the package, although the bare `@import "tailwindcss"` does. The package is pinned to 4.1.14, the compiler version bundled in `bun-plugin-tailwind` 0.1.2, so the two cannot drift. It is in the root and viewer `devDependencies`, next to the plugin.
5. **MIT banner question.** The built CSS holds Tailwind's theme and utility rules and a one-line banner. MIT requires the full copyright and permission text with copies, and the banner is not that text. `EMBEDDED_DEV_PACKAGES` now lists `tailwindcss`, so `THIRD-PARTY-NOTICES.txt` carries its license (6 npm packages now, was 5). `bun-plugin-tailwind` only runs during the build and ships nothing, so it stays out. `scripts/notices.test.ts` was updated for the list, and its missing-package test uses a placeholder name.
6. **Smoke check for raw CSS.** `scripts/smoke.ts` now fails when any served stylesheet still contains `@tailwind`, `@theme` or `@import "tailwindcss`. A build that skips the plugin would then fail on every CI target. This is the acceptance criterion's proof.
7. **Biome.** The CSS parser needs `tailwindDirectives: true` in `biome.json`, or `biome ci` rejects `@theme`.
8. **Dev serve.** The audit found that `bun server/src/main.ts` would serve raw directives, because only the build script loaded the plugin. `bunfig.toml` now has `[serve.static] plugins = ["bun-plugin-tailwind"]`. A dev run serves processed CSS with the Tailwind banner.
9. **Test edit.** The `.art-tile` ordering test in `viewer/src/icons.test.tsx` checks the same order as before. It uses the new token name and the indentation inside the layer.
10. **New test.** `scripts/build-exe.test.ts` checks the plugin is always passed, the target and define mapping, the executable path mapping and the refusal of both together.

## Evidence

- `bun run build:exe` and a CI-shaped build (`--target=bun-linux-x64-baseline --label ... --commit ...`) succeed, and `bun scripts/smoke.ts` passes on both. `bun test server/test/e2e` with the executable: 14 pass.
- `bun test`: 1,698 pass, 1 fail. The failure is the known Lua 5.3/5.4 check on this machine's Lua 5.5. Typecheck and `biome ci` pass. `notices --check` passes.
- Served CSS from the executable has the layers theme, base, components and utilities, and no preflight rules. A comparison of the old sheet against the new one, both minified and with variable names mapped, matched 191 of 195 rules. The four others (`:root`, `.slot-empty`, `.nav-item`, `.box-mon`) differ only in how the minifier writes `transparent` and in merged `:root` blocks.
- Not tested: the Windows and macOS executables at runtime. The spike showed the plugin runs in the host Bun before the target is attached, so the styles reach every target the same way. The CI run on the merged batch is the check.

## Audit

- Round 1: approve, 8. Four minor problems. Other unlayered CSS could outrank the layer (rebutted: `styles.css` is the only stylesheet, linked once from `index.html`). Look-the-same evidence is rule-level (rebutted with the four mismatches named). The test edit (declined, reason in decision 9). Dev serve unwired (fixed, decision 8).
- Round 2: approve, 8, on the `bunfig.toml` change. One minor problem left: there is no rendered before and after comparison of the viewer. Declined: the component rules are unchanged apart from the variable names and the layer wrapper, and no browser comparison tool was set up for this ticket.
- Minor problems declined: 2 (the test edit, and the missing rendered comparison).
