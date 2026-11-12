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
