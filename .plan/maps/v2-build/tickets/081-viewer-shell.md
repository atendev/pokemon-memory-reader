---
type: task
blocked_by: []
---

# Viewer shell and connection screen

## What to build

Spec §11.1 and §11.2 plus the hash routes from [the 021 amendment](../assets/021-viewer-control-routes.md). The collapsible sidebar, the five screens' routes (Party exists already, the others render a placeholder until their tickets), and the connection screen. It reads `status` for connection state. The tracer viewer's plain CSS stays until [the Tailwind spike](./088-tailwind-under-compile-spike.md) says otherwise, so write styles that move cleanly.

## Acceptance criteria

- The shell loads in the compiled executable, and the connection screen reflects `disconnected`, `no_game`, `unidentified` and `unsupported`.
- Hash routes work with a reload, and the sidebar collapses and restores.
- Component tests follow the viewer's existing setup, and the compile smoke still passes.
