# RetroArch adapter: decision report

Ticket: [RetroArch adapter](../tickets/079-retroarch-adapter.md). Branch `t3/retroarch-adapter`. Code is in `server/src/adapter/retroarch/` (`adapter.ts`, `protocol.ts`), tests in `server/test/retroarch/`.

This ticket is a build task, so the main thread made every choice below. There was no grilling. Amendments 026 and 014 settled the rules, and this report lists only the points they left open.

## Decisions

1. **Where the code lives.** Options: one adapter file, or a pure `protocol.ts` plus the adapter. Choice: split. `protocol.ts` holds the `GET_STATUS` and `READ_CORE_MEMORY` parsers, the domain-to-bus-address table, the descriptor cut list and the chunk planner, all pure and unit tested. By: main thread.
2. **`GameInfo.contentName`.** The content name has to reach re-identification (amendment 014). Options: a new optional field on `GameInfo`, or reuse `romName`. Choice: add `contentName?: string | null`, and also set `romName` to the same value for logs. Optional, so bridge code and fixtures stay unchanged. By: main thread.
3. **Reply matching.** A short reply can't match a chunk on its own byte count, so "echoed address and byte count" (026 point 5) needs a rule. Choice: match on address. A reply whose byte count equals a waiting chunk's length settles that chunk. A shorter reply fails the shortest chunk it can't fill (slice `null`, logged once per session). A longer reply, or one at an unknown address, is discarded. Two waiters at one address, such as a batch and a ROM check, are both fed. By: main thread.
4. **Duplicate chunks.** Two ranges that cut into the same address and length share one datagram. By: main thread.
5. **System ids.** The spike hasn't confirmed RetroArch's ids, so `platformOf` accepts `gba`, `game_boy_advance`, `gb`, `gbc`, `game_boy`, `game_boy_color` and `gameboy`. Anything else is "other" and gives `no_game`. The spike (spec §15) adjusts the list. By: main thread.
6. **Domain sizes.** GBA: rom 32 MiB window, ewram 0x40000, iwram 0x8000. GB: rom 0x8000, wram 0x2000, hram 0x7f, sram 0x2000. A core that maps no ROM answers the header read with an error, so identification ends `unidentified` (026 point 3). Gen 1-2 specifics belong to later tickets. By: main thread.
7. **Descriptor cuts.** Only the one 026 names: GB WRAM at offset 0x1000 (bus 0xD000). The table is data, so the spike can add more. By: main thread.
8. **Status polling and the 2 s check.** `read()` sends the 1 s `GET_STATUS` with its batch when 1 s has passed since the last one. The 2 s check is a separate timer that sends `GET_STATUS`, then reads the header if the system is GB or GBA. A 1 s reply ends the game at once for `CONTENTLESS` or an unread system. Any other change waits for the check. A timeout or `GET_STATUS ERROR` changes nothing. The check's first header read only sets the baseline. By: main thread, from 026 point 4 and 014 item 6.
9. **Probe and reconnect.** The probe is one `GET_STATUS` with a 1 s wait. An ICMP error on the socket ends it at once. Silence leaves `problem` null and re-probes on the bridge backoff (500 ms doubling to 5 s). In probe mode, a valid reply reports `connected` so the selector can decide inside its listener, and then the adapter returns to `disconnected`. Only live or hold stays up. `GET_STATUS ERROR` is not a valid probe reply. By: main thread, after audit round 1.
10. **30 s disconnect.** Armed on every datagram while live. Hold mode sends nothing, so it has no watchdog. By: main thread.

## Audit

Council audit, Claude seat only. Gemini and GPT seats skipped (out of quota). Approval rests on the Claude seat.

Round 1: DISAPPROVE, 6. Problems:

- Blocking: the header sentinel `"unmapped"` is compared like header bytes. Rebutted: amendment 014 item 6 says the header read switching between data and an unmapped-address error re-identifies, and a test covers it.
- Fixed: `close()` left reads waiting out their timeout, so it now fails them as disconnected.
- Fixed: backoff reset on every probe success made a probe-mode adapter re-probe every 0.5 s. It now resets when the adapter goes live.
- Fixed: `GET_STATUS ERROR` counted as a valid probe reply. It no longer does.
- Declined: the seat could not run the tests in its tool budget. The main thread ran them, and 38 pass in `server/test/retroarch`.

Round 2: APPROVE, 8. The seat dropped the blocking problem after the rebuttal. Two minor problems declined:

- `close()` leaves `state.connection` at `connected` and tells no listener. The bridge adapter's `close()` also ends with listeners cleared, and the selector drops a closed adapter, so nobody reads the stale snapshot.
- Ignoring `GET_STATUS ERROR` during the probe is a reading the amendment doesn't state. 026 point 1 lists only `CONTENTLESS`, `PLAYING` and `PAUSED` as valid, so an error reply counts as no reply.

Scores: Claude 8, Gemini and GPT seats skipped.

## Verification

- `bun test server`: only the known host Lua check in `server/test/bridge/core.test.ts` fails (host `lua` is 5.5, CI uses 5.4).
- `bun run typecheck` and `bun run lint` pass.
- Not covered: a real RetroArch smoke test (a later HITL ticket) and the spike items in spec §15 (system ids, descriptor list, one-command-per-frame behavior).
