---
type: grilling
blocked_by: [018]
assets: []
---

# Config file

## Question

Where does the config file live, what format is it, and which settings does it hold?

Settings so far come from [App form factor](./003-app-form-factor.md) (adapter pin, probing, bind address, port, browser auto-open) and [Viewer design](./008-viewer-design.md) (icon source, sprite URL), plus whatever [Read loop and latency budget](./018-read-loop.md) adds. Decide the location per OS, format, precedence of flags over file, whether the viewer writes the file, and where the user profiles folder lives.

Input from [Battle tracker data model](./012-battle-tracker-data-model.md): viewer display preferences such as "Show unrevealed opponent Pokémon" live in the browser's localStorage, with URL query overrides, and not in the config file.

Input from [Importable package for overlay developers](./015-importable-package.md): the package exports `DEFAULT_BASE_URL`, built from the default port and bind host this ticket settles, so pick them as named constants the package can import.

Input from [Release pipeline](./017-release-pipeline.md): add an update-check on/off setting (default on), a `--port` flag, `--no-browser`, and a data-folder override as a flag or env var that the release smoke test uses to point at a temp folder. The program must shut down cleanly with exit code 0 on SIGINT and SIGTERM, and on Ctrl+C on Windows.
