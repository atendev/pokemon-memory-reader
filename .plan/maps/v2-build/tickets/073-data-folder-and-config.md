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
