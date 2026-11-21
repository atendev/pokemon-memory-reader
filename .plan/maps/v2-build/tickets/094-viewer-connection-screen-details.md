---
type: task
blocked_by: [075, 080]
---

# Connection screen details

## What to build

Finish the connection screen from [Viewer shell and connection screen](./081-viewer-shell.md). Add the data-folder path with a copy button, the adapter list, and the text for an older or newer protocol. The viewer needs a way to learn the program's protocol number, so decide it with the routes it reads from ([settings and about](./075-settings-and-about-routes.md), [adapter selector](./080-adapter-selector-and-adapters-route.md)).

## Acceptance criteria

- The connection screen shows the data-folder path with a copy button and lists the adapters from `/adapters`.
- An older or newer protocol number shows its own text.
- Component tests cover each case, and the compile smoke still passes.
