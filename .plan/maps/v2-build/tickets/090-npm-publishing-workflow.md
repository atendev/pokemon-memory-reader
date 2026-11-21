---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T13:30:00Z
---

# npm publishing workflow for the API package

## What to build

Spec §13.8 and §10. A workflow that publishes `@pokemon-memory-reader/api` from `api-v*` tags, checked by the same ref rules as the app release. Build on the existing `api-package` CI job (`publint`, `attw`, the packed-tarball check without `zod`). It must support a dry run on `workflow_dispatch` that runs `npm publish --dry-run` and never publishes.

## Acceptance criteria

- The dry run succeeds on the branch and shows the file list and exports map.
- A real publish step exists but runs only on a matching tag, and its secret is read from the repository, never printed.
- The workflow refuses a stable `api-v2.0.0` tag from any ref but main.
