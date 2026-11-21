---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795256075
claimed_at: 2026-11-21T10:15:08Z
---

# Viewer shell and connection screen

## What to build

Spec §11.1 and §11.2 plus the hash routes from [the 021 amendment](../assets/021-viewer-control-routes.md). The collapsible sidebar, the five screens' routes (Party exists already, the others render a placeholder until their tickets), and the connection screen. It reads `status` for connection state. The tracer viewer's plain CSS stays until [the Tailwind spike](./088-tailwind-under-compile-spike.md) says otherwise, so write styles that move cleanly.

## Acceptance criteria

- The shell loads in the compiled executable, and the connection screen reflects `disconnected`, `no_game`, `unidentified` and `unsupported`.
- Hash routes work with a reload, and the sidebar collapses and restores.
- Component tests follow the viewer's existing setup, and the compile smoke still passes.

---

The viewer has a collapsible sidebar (a 72 px icon rail when collapsed, restored from `localStorage`), hash routes for Party, Battle, Boxes, Trainer & bag, Settings and About, and a connection screen for `disconnected`, `no_game`, `unidentified` and `unsupported`. [Report](../assets/081-viewer-shell-report.md).

- `unsupported` is not a `status.state` value. The Party screen shows it when the party resource answers 503 `unsupported` while the state is `game`.
- Settings and About show without a game. Battle, Boxes and Trainer & bag are placeholders until their tickets, and the Battle dot waits for [the Battle screen](./082-viewer-battle-screen.md).
- Left out because their routes don't exist yet: the adapter list, the data-folder path with a copy button, the older or newer protocol text, the update banner and the identification notes. They are surfaced as tickets.
- `bun test viewer` (51 pass), `bun run typecheck`, `bun run lint`, `bun run build:exe` and the compile smoke pass locally. No browser ran the bundle. CI is left to the master.
- Council, Claude seat only: approved in round 2 (claude 8). Gemini and GPT seats skipped (out of quota).

Timing: wall 6m, active 6m, user 0s, wait 0s, blocked 0s | setup 3m, audit 2m (2 rounds) | tools 39 (6 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 149k | cost $1.58 sonnet-5-5 + $0.02 haiku-5-5
