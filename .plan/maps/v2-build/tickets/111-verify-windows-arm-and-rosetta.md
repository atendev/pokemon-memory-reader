---
type: task
blocked_by: []
---

# Verify `windows-11-arm` with `setup-bun` and the Rosetta step on a dry run

## What to build

Surfaced by [`release.yml` and per-OS archives](./089-release-workflow.md). The `windows-11-arm` runner with `setup-bun`, and the Rosetta step for macOS, are unverified until CI runs. Trigger the `release.yml` dry run on the master branch, read the logs and fix what fails in the workflow.

## Acceptance criteria

- A dry run builds every target, including `windows-11-arm`, and uploads artifacts only.
- Any failing step is fixed in `release.yml` and the dry run is repeated until green.
- The report records the run link and what changed.
