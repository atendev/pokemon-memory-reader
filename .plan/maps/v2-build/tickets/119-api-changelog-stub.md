---
type: task
blocked_by: []
---

# `api/CHANGELOG.md` stub for the API package release

## What to build

Surfaced by [README SmartScreen text and `CHANGELOG.md` for the release body](./110-changelog-and-smartscreen-text.md) and [npm publishing workflow for the API package](./090-npm-publishing-workflow.md). A real `api-v*` tag fails the publish workflow before publishing unless `api/CHANGELOG.md` has a section for that version. Add the file with a `2.0.0-beta.1` stub that the workflow's changelog check finds.

## Acceptance criteria

- `api/CHANGELOG.md` exists and the `release-api.yml` check finds the `2.0.0-beta.1` section.
- A test fails when the section for the package version is missing.
