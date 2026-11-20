---
type: task
blocked_by: []
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
