---
type: grilling
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794582779
claimed_at: 2026-11-13T15:12:59Z
---

# How are ROMs keyed and re-identified?

## Question

Spec §17 item 2. Decide how manual picks are keyed when the mGBA bridge sends only `crc32`, how GB ROMs (no game code) are keyed, what happens on RetroArch cores that give no ROM or hash, the header re-read interval, and whether bridge adapters run that timer.

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Handoff

- Branch `t3/rom-keying-reidentification` is pushed. The resolution is commit `5c3e475`, "plan: decide how ROMs are keyed and re-identified", and this handoff commit sits on top of it.
- Done:
  - The grilling interview is complete, and the owner confirmed every decision.
  - Written: [the amendment](../assets/014-rom-keying-and-reidentification.md), [the decision report](../assets/014-rom-keying-and-reidentification-report.md), and three research files (`014-mgba-checksum-types.md`, `014-retroarch-get-status.md`, `014-randomizer-rom-identity.md`).
  - The `CONTEXT.md` glossary now covers base-game picks under Manual pick and adds Modified ROM.
  - The `haiku` auditor approved in round 5 of 5, with no open objections.
  - Local lint, typecheck and tests pass. `map.md` is untouched.
  - The master was told PUSHED. The CI result is pending.
- Left, in order:
  1. Wait for the master's CI result for this branch.
  2. On CI red, run runner step 7 with a new auditor, then commit, push and return PUSHED.
  3. On CI green or no CI, add `## Answer` to this ticket and delete this section in the same commit. A draft Answer is at `/tmp/r014-commit/answer.md`. If that file is gone, write the decision, reason and exclusions from the amendment's items 2 to 7, Why and Excluded. Commit, push, and return DONE.
  4. DONE report:
     - Decision: `- [How are ROMs keyed and re-identified?](./tickets/014-rom-keying-and-reidentification.md): picks key by any emulator hash, else a header key tagged with the platform, plus RetroArch's content name; an opt-in base-game pick covers randomizer seeds; only RetroArch re-checks, every 2 s; the mGBA bridge stays CRC32-only.`
     - Surfaced: none.
     - Notes for tickets 021, 026 and 004 are in the amendment's Hand-offs section.
- Read first: this ticket, then the amendment.
