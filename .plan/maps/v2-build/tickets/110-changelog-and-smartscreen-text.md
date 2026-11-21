---
type: task
blocked_by: []
---

# README SmartScreen text and `CHANGELOG.md` for the release body

## What to build

Surfaced by [`release.yml` and per-OS archives](./089-release-workflow.md). `CHANGELOG.md` doesn't exist, so a real tag fails the body step until it has a section for that version. The README also lacks the Windows SmartScreen text the release body links to. Add both, with a `v2.0.0-beta.1` section stub that the release candidate fills in.

## Acceptance criteria

- `CHANGELOG.md` exists and the body step finds a section for the tag's version.
- The README explains the SmartScreen prompt and how to proceed.
- A test keeps the body's links pointing at real README anchors.
