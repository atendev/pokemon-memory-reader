---
type: task
blocked_by: [076]
---

# Viewer update banner

## What to build

Show a banner in the viewer shell when [the update check](./076-update-check-and-update-route.md) reports a newer release. The shell comes from [Viewer shell and connection screen](./081-viewer-shell.md).

## Acceptance criteria

- The banner shows only when `/update` reports a newer release, and it can be dismissed for the session.
- Component tests cover both states, and the compile smoke still passes.
