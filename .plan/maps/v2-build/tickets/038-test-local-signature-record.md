---
type: task
blocked_by: [037]
claimed_by: wayfinder-master v2-build-master-1794843940
claimed_at: 2026-11-16T16:05:32Z
---

# Build `test:local` with its signature check and `--record` call

## Question

[Signature evidence ledger, generator field and release gate](./037-signature-evidence-ledger.md) built the ledger and `recordSignatureCheck`, but `test:local` doesn't exist yet. Build it per [the 022 amendment](../assets/022-unowned-revision-signatures.md): it runs against ROMs on the owner's machine, checks each owned revision's signature, and with `--record` writes the result to the ledger through `recordSignatureCheck`. A failed owner check blocks that repo's profiles.

## Acceptance

- Tests drive `test:local` against synthetic ROM-shaped buffers, never a real ROM, and cover pass, fail and `--record`.
- `--record` updates only the ledger, and a second run with the same inputs gives no diff.
- No ROM bytes are committed.

## Answer

Built per [the 022 amendment](../assets/022-unowned-revision-signatures.md). `bun run test:local` (in `scripts/test-local.ts`) checks every signed official built-in profile against the ROM named by `PMR_ROM_<profile ID>`. An unset variable prints `not run`, and a set variable pointing at a missing file fails. A check passes when the ROM's SHA-1 is in the profile's `identify.sha1` and every signature word matches its bytes in the ROM.

`--record` appends each passing check through `recordSignatureCheck` and writes nothing else. A second run with the same inputs gives no diff, even on a later day. A failed check exits 1, prints a `blocked` line for its pret repo, and records nothing for that repo on that run. Other repos still record. The block lasts only for the run, because the ledger holds passes only and the 037 gate reads no failure state. Making the block persist is a surfaced ticket. `.gitignore` now lists `fixtures-local/`.

Tests use synthetic ROM-shaped buffers only, and no ROM bytes are committed. Excluded: deleting earlier ledger entries on a failure, and per-game-family env vars.

Report: [038 report](../assets/038-test-local-signature-record-report.md). Audit: APPROVE in round 2. CI green on PR 34.
