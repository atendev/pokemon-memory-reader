---
type: grilling
assets: [../assets/020-status-and-error-details.md, ../assets/020-status-and-error-details-report.md]
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794786410
claimed_at: 2026-11-15T23:46:50Z
---

# What fills the unset status and error details?

## Question

Spec §17 item 8. Decide the 503 code for a cold read that times out with a game loaded, the body of the SSE `400`, `status.rom` while disconnected or with no ROM and the nullability of its header fields, and the remaining `status.adapter` fields.

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

A grilling subagent decided this in auto-mode on 2026-11-15, and the audit approved it in round 4. The full amendment, which spec §7.2, §7.4, §8.2 and §8.3 will cite, is in [020-status-and-error-details.md](../assets/020-status-and-error-details.md). The decision report is [020-status-and-error-details-report.md](../assets/020-status-and-error-details-report.md).

- Every error body is `{ error: { code, message }, status }`, including the 404 and the SSE 400. The 400 uses code `invalid_topics`, and its message lists the known topics. `message` is English text with no stability promise.
- The new 503 code `no_data` covers a cold read that times out or returns nothing while a game is loaded, a demanded resource that has never decoded a value, and a box with no cache whose first read fails. The 503 checks run in this order: `disconnected`, `no_game`, `unidentified`, `unsupported`, then `no_data`. For `/boxes/:n` the `:n` check comes before `no_data`.
- `status.rom` is `null` when the adapter reports no ROM. Otherwise it is an object, whatever the state. It gains `platform` (closed `gb | gba | other`), `globalChecksum` (GB) and `contentName` (RetroArch). `title`, `gameCode`, `revision` and `globalChecksum` are null when the header can't be read, and `gameCode` is always null on GB.
- `rom.title` is ASCII. GBA uses 12 bytes, and GB uses 16 bytes, or 15 when the CGB flag is set. The program cuts it at NUL, replaces non-printable bytes with `?` and trims trailing spaces. The header key escapes it per amendment 014.
- `status.adapter` is exactly `{ id, stalled, bridge, problem }`.

Why: one error schema and one "no value yet" code give clients one retry rule, and `status` already explains the cause. Keying `rom` on what the adapter reports keeps "no ROM" apart from "a ROM the program can't read" without new states. Excluded: separate `timeout` and `no_data` codes, a 400 without `status`, an all-null `rom`, a GB `gameCode`, 16-byte and 11-byte CGB title reads, and `endpoint` or `pinned` on `status.adapter`.
