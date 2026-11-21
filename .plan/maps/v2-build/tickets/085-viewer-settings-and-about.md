---
type: task
blocked_by: [075, 076, 081]
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T13:05:00Z
---

# Viewer Settings and About screens

## What to build

Spec §11.7. Settings shows endpoints, `pollHz` and `updateCheck` from `/settings`, the adapter picker when [the adapter selector](./080-adapter-selector-and-adapters-route.md) exists, and the manual pick control. About shows the version, the LGPL lines and a link to the notices file. The update banner reads `/update`. `paths` is shown only when it is not null.

## Acceptance criteria

- Component tests cover each section, a null `paths`, and a banner with and without a newer release.
- Writes go through the guarded routes and show a refusal clearly.
- It runs against the fake bridge in the compiled executable.
