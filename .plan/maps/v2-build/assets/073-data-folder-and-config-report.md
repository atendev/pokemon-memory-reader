# Data folder and config.json, decision report

Ticket: Data folder and `config.json` (spec §9.1 to §9.4). Branch `t3/data-folder-and-config`. Audit verdict: APPROVE in round 1 from the Claude seat, score 8. The Gemini and GPT seats were skipped because they are out of quota. Approval rests on the Claude seat.

## Decisions

1. **Where the schema lives.** Question: where does the config schema go? Options were `server/` or `internal/`. Choice is `internal/src/config.ts`, as the spec requires. Made by the implementer. `internal` gained two dependencies, `zod` and the `api` workspace package, for `DEFAULT_PORT` and `DEFAULT_HOST`. Audit verdict: approved.

2. **How a bad key is handled.** Question: does one invalid value reject the whole file? Options were a whole-object Zod parse or a per-key check. Choice is a per-key walk over the schema's shape, so one bad value falls back to its own default with one warning and the other keys still load. This is what spec §9.4 says. Made by the implementer. Audit verdict: approved.

3. **pollHz clamp.** The schema clamps an out-of-range integer to 5-60 with a transform. The walk warns when the parsed value differs from the given one. A non-integer or non-number fails the schema and falls back to 20 with a warning. The loop keeps its own `normalizePollHz`, so a value passed straight to the loop still clamps, and the constants now come from `internal`. Made by the implementer. Audit verdict: approved.

4. **Unknown keys and newer versions.** Unknown keys, including nested ones, produce one warning that lists every path, and the file's own shape is kept in `unknown` for later saves. A `configVersion` above 1 runs on the known keys, refuses saves, and replaces the unknown-key warning with a single version warning. An invalid `configVersion` falls back to 1 and does not refuse saves. Made by the implementer. Audit verdict: approved.

5. **Unreadable file.** Spec §9.4 does not name a file that exists but cannot be read. The implementer treats it like a malformed file, with an error, defaults and refused saves, under a `SaveRefusal` value of `unreadable`. Audit verdict: approved.

6. **Flags as nulls.** Question: how does the file's value reach a flag-less run? Options were defaults in `parseArgs` or null for an absent flag. Choice is null, so `resolveConfig` can apply flag over file over default and record each setting's source. `--no-browser` is `false`, so the option type is `false | null`. Made by the implementer. Audit verdict: approved.

7. **Where config.json lives.** `resolvePaths` in `data-folder.ts` returns the data folder, `config.json`, `profiles/`, `icons/` and `icon-cache/`. `config.json` follows `XDG_CONFIG_HOME` only on Linux with no `--data-dir` and no `PMR_DATA_DIR`. In every other case it sits in the data folder. An empty `PMR_DATA_DIR` counts as unset. These paths are what the `/settings` ticket reads. Made by the implementer. Audit verdict: approved.

8. **Moment a change applies.** Question: how does a test show a setting changing at its documented moment, with no `/settings` route yet? Choice is a `Config` object with `change(patch)`, which models what a save does in memory. Live keys (`adapter`, `adapters`, `pollHz`, `updateCheck`, `icons`) apply at once and notify listeners. Startup keys (`port`, `host`, `openBrowser`) stay at their running value and show up in `pending()`. A hand edit is never seen, because nothing watches the file. Made by the implementer. Audit verdict: approved.

9. **Live pollHz.** The loop gained `setPollHz`, which takes effect from the next tick. `startServer` exposes it, and `main.ts` calls it from the live listener. Made by the implementer. Audit verdict: approved.

10. **Startup output.** The Config file line follows the Data folder line, with "not created yet, using defaults" when the file is missing. The configured mGBA endpoint replaces the hard-coded one for both the bridge and the adapter. A failing built-in profile still stops startup, and the profile loading is unchanged. Made by the implementer. Audit verdict: approved.

## Minor problems declined

- **Windows path separators in the data-folder test.** The Windows case builds its expected paths with the host's `join`, so Linux does not check backslashes. Declined because one seat raised it and the code only needs the base folder, the subfolder name and the config placement, which the test checks.
- **No test that a config file's pollHz reaches the loop through `main.ts`.** Declined because the clamp and warning are tested at the config and loop layers, `main.test.ts` starts the program from a file with `pollHz: 500`, and the wiring is one line in `main.ts`.
- **Only pollHz has a live consumer.** Declined because the adapter selector, update check and icon tickets own the other consumers, and nothing calls `change()` until the `/settings` ticket.

## Test results

Typecheck and `biome ci` are clean. 675 tests pass. One fails, the Lua version check in `server/test/bridge/core.test.ts`. The host's default `lua` is 5.5 and CI uses 5.4, so it is ignored.
