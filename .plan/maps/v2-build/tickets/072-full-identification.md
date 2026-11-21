---
type: task
blocked_by: []
claimed_by: wfm-v2-build-master-1795256075
claimed_at: 2026-11-21T11:02:23Z
---

# Full ROM identification: hash, signature and match

## What to build

Spec §5.4, [the 014 amendment](../assets/014-rom-keying-and-reidentification.md), [the 022 amendment](../assets/022-unowned-revision-signatures.md) and [the 025 amendment](../assets/025-spec-text-mismatches.md). [The tracer](./009-tracer-api.md) identifies by header only, so `status.rom.match` is `header` and `signature` is `unchecked`. Add hash matching (SHA-1 where the emulator provides it, else CRC32, with RetroArch's content name when it has no hash), the signature check against the profile's signature words, and the four `status.game.signature` values. A profile with no signature declares none, and an adapter without ROM reads leaves the signature fields null (025).

Identification stays a single request-slot job, and a failed signature on a hash match reports the mismatch through `status` as the spec says. RetroArch's 2 s re-check belongs to the RetroArch adapter ticket, and the manual picks belong to their own ticket.

## Acceptance criteria

- Tests cover a hash match, a header-only match, a signature match, a signature mismatch and a profile with no signature.
- `/status` reports `match`, `signature` and the `rom` fields from [the 020 amendment](../assets/020-status-and-error-details.md) through the real server and fake bridge.
- The mGBA bridge identifies by CRC32 only, as 014 says.
- No ROM bytes are committed.

Timing: wall 6m, active 6m, user 0s, wait 0s, blocked 0s | implement 3m, audit 2m (2 rounds) | tools 42 (5 subagent) | limits 0, compactions 0, handoffs 0 | ctx peak 138k | cost $1.56 sonnet-5-5 + $0.02 haiku-5-5

## Resolution

Identification now follows spec §5.4: exact hash (SHA-1 when supplied, else CRC32), then header plus signature, then header alone, in one request-slot job. `status.game.match` is `exact` or `header`, and `signature` is `match`, `mismatch`, `unchecked` or `null` (amendment 025 §3). A hash match checks the signature in the same read as the header and still loads on a mismatch, with a logged profile error. A hash that matches nothing while the header matches a base game, or a header match whose signature fails or can't be read, stays `unidentified` (internal reason `modified_rom`). An adapter that can't read ROM matches by hash and reports `unchecked` for a profile with a signature, following 025 over the ticket's "null". `status.rom.contentName` is filled from the adapter. The mGBA bridge already sends CRC32 only. `romKeys` is left to the manual-picks ticket. Report: [072 report](../assets/072-full-identification-report.md). Audit: Claude seat only, approved in round 2 (8).
