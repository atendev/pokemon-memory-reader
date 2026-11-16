---
type: task
blocked_by: []
---

# Mirror Bun's LGPL sources

## Question

HITL. Per [the 042 amendment](../assets/042-bun-lgpl-terms.md), the owner forks Bun, tinycc and WebKit and creates ruleset-protected `pmr-bun-v<ver>` tags at the pinned Bun version. Write a `wizard.sh` for the owner's steps, then check the tags exist.

## Acceptance

- The three forks carry the protected tag for the `packageManager` Bun version, and a check script confirms it.
