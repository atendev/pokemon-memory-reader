---
type: task
blocked_by: []
---

# Owner wizard for the first npm publish

## What to build

HITL. Surfaced by [npm publishing workflow for the API package](./090-npm-publishing-workflow.md). Write a `wizard.sh` that walks the owner through the steps only they can do: claim the `pokemon-memory-reader` npm org, publish and deprecate the 0.0.0 placeholder, and register the trusted publisher for `release-api.yml`. This waits until the owner is ready to cut `v2.0.0-beta.1`. Never ask for or store an npm token.

## Acceptance criteria

- The wizard covers each step with the exact values to enter and a check that proves it.
- It never prints or stores a secret.
- The report records which steps the owner completed.
