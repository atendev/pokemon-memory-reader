---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T15:30:00Z
---

# README SmartScreen text and `CHANGELOG.md` for the release body

## What to build

Surfaced by [`release.yml` and per-OS archives](./089-release-workflow.md). `CHANGELOG.md` doesn't exist, so a real tag fails the body step until it has a section for that version. The README also lacks the Windows SmartScreen text the release body links to. Add both, with a `v2.0.0-beta.1` section stub that the release candidate fills in.

## Acceptance criteria

- `CHANGELOG.md` exists and the body step finds a section for the tag's version.
- The README explains the SmartScreen prompt and how to proceed.
- A test keeps the body's links pointing at real README anchors.

## Answer

`CHANGELOG.md` now holds a `2.0.0-beta.1` stub that `changelogSection` finds, so the body step passes for that tag. The README has a "Running a downloaded build" section with the Windows SmartScreen steps (More info, then Run anyway), the macOS quarantine command and the supported targets. `scripts/release-notes.md` links to those README anchors with `{{repo}}` and `{{tag}}` placeholders that `buildBody` fills before the tag-pin lint. A test in `scripts/check-release-ref.test.ts` builds the real body and checks every README anchor link against the README headings.

Excluded: `api/CHANGELOG.md` for the API package release. The release candidate must fill in the stub's Highlights and Fixes.

Report: [110 report](../assets/110-changelog-and-smartscreen-text-report.md). Audit: APPROVE in round 2, Claude seat only (Gemini and GPT: not run). CI not run here, the master runs it on the merged batch.

Timing: wall 3m, active 3m, user 0s, wait 0s, blocked 0s | implement 36s, audit 2m (1 round) | tools 20 (5 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 73k | cost $0.52 sonnet-5-5 + $0.01 haiku-5-5
