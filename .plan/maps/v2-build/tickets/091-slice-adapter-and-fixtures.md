---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T13:30:00Z
---

# `SliceAdapter`, fixture files and golden files

## What to build

Spec §12.1, §12.2, §12.3 and §12.5. The fixture file format, the `SliceAdapter` that serves captured slices to the real decoders, and golden files for decoded output. No ROM bytes are ever stored (§12.2), so fixtures hold only the live-memory slices the spec allows and the trainer tables count as missing. Build it against synthetic slices first. The first real capture is a later ticket.

## Acceptance criteria

- A fixture round-trips through the file format and a `SliceAdapter` serves it to the party decoder.
- A golden-file test fails with a readable diff when a decoded value changes.
- A test proves a fixture containing ROM-table bytes is rejected.
