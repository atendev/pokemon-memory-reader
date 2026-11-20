---
type: task
blocked_by: [081, 086]
---

# Viewer icon use and icon packs

## What to build

Spec §11.9, viewer side. The viewer asks `/icons` for species, item and type icons, falls back when one is missing, and supports the icon pack the spec defines. Read the section first and stop with a grilling ticket if it needs a decision the spec doesn't make.

## Acceptance criteria

- Component tests cover a found icon, a missing icon fallback and a pack switch.
- The party screen uses icons without layout shift.
- It runs against the fake bridge in the compiled executable.
