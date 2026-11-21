---
type: task
blocked_by: [075, 080]
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T14:10:00Z
---

# Connection screen details

## What to build

Finish the connection screen from [Viewer shell and connection screen](./081-viewer-shell.md). Add the data-folder path with a copy button, the adapter list, and the text for an older or newer protocol. The viewer needs a way to learn the program's protocol number, so decide it with the routes it reads from ([settings and about](./075-settings-and-about-routes.md), [adapter selector](./080-adapter-selector-and-adapters-route.md)).

## Acceptance criteria

- The connection screen shows the data-folder path with a copy button and lists the adapters from `/adapters`.
- An older or newer protocol number shows its own text.
- Component tests cover each case, and the compile smoke still passes.

## Answer

`GET /about` now carries `protocol`, the program's bridge protocol number, so the viewer can compare it with a bridge's number. The connection screen (`viewer/src/ConnectionScreen.tsx`) shows the data folder with a copy button (`CopyButton.tsx`, `copy.ts`), the adapter list from `/adapters` with each probe result, and separate text for an older or a newer bridge protocol, both in the headline and in the adapter row. A null `paths` says to open the viewer on the host machine. The details load only while a game route shows the connection screen. The update banner is already global from ticket 085, so ticket 095 needs no build. Audit: Claude seat only, approved at round 1 with a score of 8. [Report](../assets/094-viewer-connection-screen-details-report.md).

Timing: wall 3m, active 3m, user 0s, wait 0s, blocked 0s | implement 2m, audit 57s (1 round) | tools 32 (3 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 96k | cost $0.97 sonnet-5-5 + $0.01 haiku-5-5
