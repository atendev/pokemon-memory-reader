---
type: task
blocked_by: []
---

# Move viewer components from `styles.css` classes to Tailwind utility classes

## What to build

Surfaced by [Convert the viewer to Tailwind](./121-convert-viewer-to-tailwind.md). The conversion kept the viewer's rules in `@layer components` in `styles.css` so the look did not change. Utility classes already work in the compiled executable. Optional: move component styles into utility classes in the components, one screen at a time, and delete the rules each move makes unused.

## Acceptance criteria

- Each moved component renders the same as before, and the viewer component tests pass.
- `styles.css` loses the rules the move made unused, and no rule is left that nothing uses.
- The compiled executable smoke test passes.
