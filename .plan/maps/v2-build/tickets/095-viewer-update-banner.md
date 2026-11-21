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

## Ruled out

[Viewer Settings and About screens](./085-viewer-settings-and-about.md) built the update banner globally. It shows only when `/update` reports a newer release, can be dismissed once per version and shows on the connection screen, as [Connection screen details](./094-viewer-connection-screen-details.md) confirmed. A separate banner ticket would duplicate it.
