# `bun-plugin-tailwind` under `bun build --compile`

Spike for [Does `bun-plugin-tailwind` work under `--compile`?](../tickets/088-tailwind-under-compile-spike.md). Spec §15 and the map's viewer fog.

## Answer

**Yes, but not through the `bun build --compile` command line.** The plugin works when the executable is built with the `Bun.build` API, `plugins: [tailwind]` and a `compile` option. The command-line build with the plugin set in `bunfig.toml` (`[serve.static] plugins`, the only command-line route I tried) ignores it and ships the stylesheet with its Tailwind directives unprocessed. So the viewer can use Tailwind, and the CI and release compile steps have to move to a build script first.

## Versions

- `bun-plugin-tailwind` 0.1.2 (latest on npm, peer `bun >=1.0.0`). It bundles its own Tailwind compiler, which printed `tailwindcss v4.1.14` in the output banner.
- `tailwindcss` 4.3.5 (latest on npm). Not needed: with it removed from `viewer/package.json`, `@import "tailwindcss"` still resolved and built the same output. The banner shows 4.1.14 while 4.3.5 was installed, so the plugin's bundled copy is what runs. I did not build with a different `tailwindcss` pin, but the result with the package absent suggests a separate pin adds nothing.
- Bun 1.4.2, the repo's `packageManager` pin, on linux-x64.

## What I ran

All of it in a scratch copy of the repo (`git archive HEAD`) outside the worktree. The repo gains only this note, the ticket's resolution and the decision report.

The test change in the scratch copy: `viewer/src/tailwind.css` holding `@import "tailwindcss";`, a `<link>` to it in `viewer/src/index.html`, and a marker `<div class="bg-[#123456] p-[13px] rounded-xl">`. The marker's arbitrary values only exist in the output if Tailwind scanned the HTML and generated them.

| Attempt | Result |
|---|---|
| `bunfig.toml` `[serve.static] plugins = ["bun-plugin-tailwind"]`, then `bun build --compile --target=bun-linux-x64-baseline --outfile out/pmr server/src/main.ts` | **Fails with only a warning.** The build still exits 0 and warns `invalid @ rule encountered: '@theme'` and `'@tailwind'`. The served CSS keeps both directives raw and has no marker class. |
| `viewer/build-exe.ts`: `Bun.build({ entrypoints: ["../server/src/main.ts"], plugins: [tailwind], compile: { target: "bun-linux-x64-baseline", outfile } })` | **Works.** No warnings. The served CSS has no `@theme` or `@tailwind`, holds the preflight reset, `padding: 13px`, the `#123456` background and `.rounded-xl`. |
| `bun run notices`, then `bun scripts/smoke.ts out/pmr-api 2.0.0-alpha.0` on the API-built executable | **`smoke passed`** (version, `status`, viewer HTML and assets, bridges, `/about`, notices, SIGTERM exit 0). Without `bun run notices` first, smoke fails on `/about` for both builds, which CI already handles. |
| The API with `define: { PMR_TARGET, PMR_COMMIT }` and `compile: { executablePath: <copy of bun>, outfile }` (the `rehost-smoke` shape) | Builds and passes smoke. |
| The API with `compile.target` set to `bun-windows-x64-baseline`, `bun-darwin-arm64` and `bun-linux-arm64` | All three build. Each binary holds the processed CSS: the `padding: 13px` and `border-radius: var(--radius-xl)` rules were found in all three. Raw `@theme` text still matches inside every binary, but the no-plugin build has it too, so it is a Bun runtime string. Only the linux-x64 build's served CSS was checked for it directly. |
| Dev run `bun server/src/main.ts` with the `bunfig.toml` plugin line | Works only when `bun-plugin-tailwind` resolves from the repo root. As a viewer-only dependency it failed with `Cannot find package 'bun-plugin-tailwind' from '<root>'`. With it also in the root `devDependencies`, the page bundles and the CSS is processed. |

Command for the working build, run from `viewer/` in the scratch copy. The script is not in the repo, so here is its full body (`bun build-exe.ts`):

```ts
import tailwind from "bun-plugin-tailwind";
const result = await Bun.build({
  entrypoints: ["../server/src/main.ts"],
  plugins: [tailwind],
  compile: { target: "bun-linux-x64-baseline", outfile: "../out/pmr-api" },
});
console.log(result.success, result.logs.map(String));
process.exit(result.success ? 0 : 1);
```

It must live in the `viewer/` workspace (or any directory where `bun-plugin-tailwind` resolves), because a script at the repo root failed with `Cannot find package 'bun-plugin-tailwind'`. The define, executable-path and cross-target runs used the same call with `define: { PMR_TARGET: JSON.stringify(target), PMR_COMMIT: '"abc1234"' }` and `compile: { executablePath, outfile }` or `compile: { target, outfile }`.

## Windows and macOS

I could not run the Windows or macOS executables on this machine. What the evidence shows: the plugin runs inside the host Bun during bundling, before the target binary is attached, and the Windows, macOS and linux-arm64 builds each hold the same processed CSS. So the styles reach every target the same way, and I expect smoke on CI's Windows and macOS runners to behave as on Linux. That expectation is untested at runtime. The `ci.yml` and `release.yml` runs on the converted build are the real check.

## What the conversion ticket must change

These are the places that call `bun build --compile` directly and so would ship unstyled CSS once the viewer uses Tailwind:

- `package.json` `build:exe`.
- `.github/workflows/ci.yml`: `compile-smoke` (`--target`, `--define`) and `rehost-smoke` (`--compile-executable-path`, `--define`).
- `.github/workflows/release.yml`: the per-target compile (`--target="$TARGET"`, `--define`).
- `docs/lgpl-relinking.md`: step that runs `bun build --compile --compile-executable-path /path/to/your/bun`. A relinker who runs that command exactly gets the raw-CSS build, so the doc must name the build script.
- `bun-plugin-tailwind` is also needed in the root `devDependencies` for `bun server/src/main.ts` to bundle the viewer in dev through the `bunfig.toml` plugin line.

`bun run notices --check` still passes with the plugin and `tailwindcss` added to `viewer/package.json`, (5 npm packages, unchanged), so the check leaves dev dependencies out. The built CSS carries Tailwind's MIT banner (`/*! tailwindcss v4.1.14 | MIT License */`) and its preflight, so the conversion ticket should decide whether `EMBEDDED_DEV_PACKAGES` (currently empty) must list it. That is for the ticket's audit, not settled here.

## Fallback

Not needed. Spec §15 names no fallback for this item. Had it failed, the plain-CSS viewer would have stayed as built in [Tracer viewer and executable](../tickets/010-tracer-viewer-and-executable.md).

## Next ticket

**Convert the viewer to Tailwind** (a `task`, no blockers). It adds `bun-plugin-tailwind` 0.1.2 pinned in the root and viewer `devDependencies`, adds a build script that calls `Bun.build` with the plugin, `define`, and `compile` target or executable path, and points `build:exe`, `ci.yml`, `release.yml` and `docs/lgpl-relinking.md` at it. It ports `viewer/src/styles.css` to utility classes, keeps `scripts/smoke.ts` and the compile-smoke job green, and decides the Tailwind notice question above. The map's "Not yet specified" line for it ("Converting the viewer to Tailwind") becomes this ticket, which the master adds.
