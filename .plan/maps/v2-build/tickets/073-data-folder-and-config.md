---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795256075
claimed_at: 2026-11-21T10:25:54Z
---

# Data folder and `config.json`

## What to build

Spec §9.1 to §9.4. The data folder location, the `config.json` schema, flags and precedence, and what happens on a bad file, plus when changes apply. Pass the configured `pollHz` into the loop in place of the tracer's default (the tracer's decision 8 left that slot). Keep `paths` ready for the `/settings` ticket. A bad user file warns and falls back, and a failing built-in profile still stops startup, as the startup ticket built it.

## Acceptance criteria

- Tests cover defaults, a valid file, a file with unknown keys, a malformed file, flag overrides and a changed setting at its documented moment.
- `pollHz` from config reaches the loop, with the out-of-range clamp and warning.
- The data folder is created where the spec says, on Linux, macOS and Windows path rules (tests use injected paths).

## Resolution

The config schema lives in `internal/src/config.ts` and checks each key on its own, so a bad value falls back to its default with one warning. Out-of-range `pollHz` integers clamp to 5-60 with a warning, and non-integers fall back to 20. Unknown keys warn once and are kept for saves. Malformed or unreadable files run on defaults and refuse saves, and a newer `configVersion` runs on the known keys and refuses saves. `server/src/config.ts` reads the file, applies flag > file > default with a source per setting, and keeps live keys (`adapter`, `adapters`, `pollHz`, `updateCheck`, `icons`) apart from startup keys (`port`, `host`, `openBrowser`), which wait in `pending()` until a restart. `resolvePaths` in `data-folder.ts` returns the data folder, `config.json`, `profiles/`, `icons/` and `icon-cache/` for the `/settings` ticket. `parseArgs` now reports absent flags as null, `main.ts` reads port, host, browser, `pollHz` and the mGBA endpoint from the config, and the loop gained `setPollHz`. Audit approved in round 1 (Claude seat 8, Gemini and GPT seats skipped, out of quota). The decision report is `../assets/073-data-folder-and-config-report.md`. The Lua 5.5 check in `server/test/bridge/core.test.ts` fails on this host and is ignored.

Timing: wall 7m, active 6m, user 0s, wait 1m, blocked 0s | implement 5m, audit 1m (1 round) | tools 38 (2 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 126k | cost $1.55 sonnet-5-5 + $0.01 haiku-5-5
