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

Timing: wall 26m, active 26m, user 0s, wait 0s, blocked 0s | setup 4m, audit 21m (2 rounds) | tools 56 (6 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 127k | cost $1.73 sonnet-5-5 + $0.02 haiku-5-5

## Answer

The fixture format is `server/src/fixture/file.ts`: a strict Zod schema with the §12.1 metadata and `regions` of `{ domain, offset, length, sha256, bytes }` in base64. The schema rejects any region in the `rom` domain (§12.2), overlapping regions, and bytes that disagree with their length or sha256. It also has `parseFixture`, `loadFixture`, `serializeFixture`, `buildFixture` and the 256 KB and 1 MB caps. `SliceAdapter` (`server/src/adapter/memory.ts`) implements `Adapter` over a fixture with `mergeGap` 0. It serves a read from contiguous recorded regions, rejects any read outside them, and its state has no `rom` domain. `server/src/fixture/golden.ts` holds `{ resources, verified }`, a deep-equality `assertGolden` that throws one error listing each difference as `path: expected X, got Y`, and no Bun snapshots. `server/test/support/run-fixture.ts` runs a Gen 3 part through `readBatch`, a `SliceAdapter` and the decoder.

A committed synthetic fixture and golden sit in `server/test/fixture/synthetic/emerald-us-1.0/`, outside `fixtures/` so the later coverage guard never mistakes them for captures. The golden's `verified` is empty. 20 tests cover the three acceptance criteria. The ROM-table rule rests on the domain label, because ROM bytes filed under another domain can't be detected without the ROM.

Excluded: the capture tool, sequence fixtures, the coverage guard (a draft golden fails it, ROM-dependent nulls never go on `verified`), and a loader that nulls ROM-table fields, none of which has a ROM-dependent decoder to test against yet. Council: Claude seat only, APPROVE 8 on round 2. [Report](../assets/091-slice-adapter-and-fixtures-report.md).
