---
type: task
blocked_by: [081, 086]
claimed_by: wfm-v2-build-master-1795260524
claimed_at: 2026-11-21T12:31:46Z
---

# Viewer icon use and icon packs

## What to build

Spec §11.9, viewer side. The viewer asks `/icons` for species, item and type icons, falls back when one is missing, and supports the icon pack the spec defines. Read the section first and stop with a grilling ticket if it needs a decision the spec doesn't make.

## Acceptance criteria

- Component tests cover a found icon, a missing icon fallback and a pack switch.
- The party screen uses icons without layout shift.
- It runs against the fake bridge in the compiled executable.

## Answer

The viewer builds `/icons/{profileId}/...` URLs from `status` and the IDs the API sends (`viewer/src/icons.ts`, `viewer/src/Art.tsx`). Party cards and battlers show a 64 px sprite, the Boxes grid and opponent tiles a 40 px menu icon, and held items and types show their icons beside the name. A missing icon, `off` mode, no game or an egg shows the spec's fallback, in a box of the same size. A failed URL stays failed until the key changes or the page reloads, so a profile switch retries. Decisions: the icon mode is read from `GET /settings` every 5 s and is null until known, so nothing is requested early; art with no provider makes no requests; Gen 1 never asks for a shiny. Bag item icons and the Settings icon section stay with their own tickets. Report: [087 report](../assets/087-viewer-icons-and-packs-report.md).

Timing: wall 6m, active 6m, user 0s, wait 0s, blocked 0s | setup 3m, audit 2m (2 rounds) | tools 58 (8 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 128k | cost $1.69 sonnet-5-5 + $0.02 haiku-5-5
