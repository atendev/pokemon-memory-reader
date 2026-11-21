---
type: task
blocked_by: []
---

# README states that the update check exists

## What to build

Spec §9.8 says the README states that the update check exists. [Update check and the `/update` route](./076-update-check-and-update-route.md) built the check, which asks GitHub for the latest release at startup and every 24 hours and can be turned off with the `updateCheck` setting. Add that statement to the README, naming the setting and what the check sends and receives. The README may not exist yet or may be v1 text, so read it first. If the release README belongs to a later ticket, add the paragraph where that ticket will find it and say so in the report.

## Acceptance criteria

- The README says the check exists, that it is on by default, how to turn it off and that it never blocks startup.
- `bun run lint` passes.
