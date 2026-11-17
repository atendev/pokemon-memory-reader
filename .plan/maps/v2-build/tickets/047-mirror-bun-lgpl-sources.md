---
type: task
blocked_by: []
---

# Mirror Bun's LGPL sources

## Question

HITL. Per [the 042 amendment](../assets/042-bun-lgpl-terms.md), the owner forks Bun, tinycc and WebKit and creates ruleset-protected `pmr-bun-v<ver>` tags at the pinned Bun version. Write a `wizard.sh` for the owner's steps, then check the tags exist.

## Acceptance

- The three forks carry the protected tag for the `packageManager` Bun version, and a check script confirms it.

## Answer

Dropped on 2026-11-17. The owner chose the lighter route: no forks, no protected tags and no wizard. [Amendment 042](../assets/042-bun-lgpl-terms.md) now says `release.yml` fetches Bun, WebKit and tinycc from upstream at the pinned versions and attaches the archives to every release itself. That work moves to [LGPL release check and source assets](./049-lgpl-release-check-assets.md). The accepted risk is that upstream could lose a pinned commit before the next release is built. The online check catches that.
