# Decision report: Bridge wire protocol

Ticket: [Bridge wire protocol](../tickets/022-bridge-wire-protocol.md), a grilling ticket. The resolution lives in the ticket's `## Answer`. This report lists every decision, who made it, and the audit verdict.

The user answered sixteen questions over two rounds through AskUserQuestion, then confirmed the full summary. A haiku auditor checked the written answer. The main thread fixed its first-round objections, and the auditor re-checked them.

## Interview decisions (made by the user)

Each item gives the question, the options offered, and the choice. The user took the recommended option every time.

1. **Who connects to whom.** Options: TCP servers in the bridges with LuaSocket on BizHawk; a BizHawk `comm.socketServer` fallback where the bridge connects out; UDP like RetroArch. Choice: both bridges are TCP servers and the program connects. If Linux BizHawk lacks LuaSocket, the docs say so and Linux BizHawk support waits.
2. **Default ports.** Options: mGBA 7426 and BizHawk 7427; BizHawk on v1's 8080; a high range at 47426/47427. Choice: 7426 and 7427.
3. **Framing.** Options: binary frames with JSON control bodies; newline-delimited JSON with base64; text lines with hex. Choice: binary frames (`u32 length | u8 kind | u32 id | body`) with JSON bodies for hello, game and error.
4. **Hello and game info.** Options: a hello plus a separate game message resent on ROM change; everything in a resent hello; the program polls for game info. Choice: hello plus a separate game message.
5. **Domain names on the wire.** Options: canonical names that the bridge maps; emulator-native names that the adapter maps; bus addresses. Choice: canonical names (`rom`, `ewram`, `iwram`, `wram`, `hram`, `sram`), mapped in each bridge, so the program has one bridge adapter.
6. **Pointer ranges.** Options: none, reusing the previous cycle's pointers; indirect ranges resolved in the bridge; two requests per cycle. Choice: direct ranges only, with previous-cycle pointers. This amends Read loop.
7. **Backlog while paused.** Options: one request in flight; the bridge answers only the newest; both. Choice: one request in flight, enforced by the adapter.
8. **Bridge port and bind address.** Options: the program writes settings into the bridge files; constants at the top of each file; fixed defaults. Choice: the program writes the configured host and port in and rewrites on content change. This amends Release pipeline.
9. **Clients per bridge.** Options: one client, extras get `busy`; newest replaces oldest; serve all. Choice: one client, with a hello to every connection, then `busy` and close for extras.
10. **Bridge source and tests.** Options: a shared Lua core plus per-emulator shims, tested in CI under Lua 5.4; two hand-written files; a shared core tested only by hand. Choice: shared core plus shims, with the core tested in CI against the TypeScript encoder's vectors.
11. **Bad ranges.** Options: the program pre-checks against domain sizes and the bridge fails a bad request whole; per-range status; the bridge clamps. Choice: program pre-checks, with whole-request failure as a backstop.
12. **Refusals.** Options: wait 3 s and keep the socket open; close and retry; fail until restart. Choice: `unknown_bridge` after 3 s with the socket kept open, an idle socket on a protocol mismatch, and close with backoff on a garbled frame. `status.adapter` gains `bridge` and `problem`.
13. **Error replies.** Options: seven codes that never count toward `stalled`; errors that count toward `stalled`; close on any error. Choice: seven codes (`bad_frame`, `busy`, `no_game`, `bad_range`, `too_large`, `unknown_kind`, `internal`) that never count toward `stalled`.
14. **Request size caps.** Options: 64 KiB and 512 ranges; 1 MiB and 4096 ranges; no caps. Choice: 64 KiB and 512 ranges, with larger reads split.
15. **Answering while paused.** Options: answer whenever the emulator runs scripts; frame-gated in both bridges. Choice: answer whenever possible, with BizHawk on `emu.yield()`.
16. **Game message contents.** Options: platform, hashes, domain sizes and ROM name; also game code and title; hashes only. Choice: platform, `crc32`, `sha1`, domain sizes and `romName`. Game code and title come from the program's own header read.

## Defaults confirmed by the user

The main thread proposed these in the final summary, and the user confirmed them:

- Big-endian frame headers.
- The bridge sends the game message before it answers any read on a new ROM, and the adapter drops replies to requests sent before that message.
- Fixed u8 codes for each domain.
- A two-stage read when no pointer value is known yet.
- Probing moves on to the next adapter that responds when a bridge is refused.
- No ping message, and TCP keepalive on the program side.
- The bridge retries a failed bind every 2 s, logs only the start and end of a serving session, and stops with a message if `string.pack` is missing.

## Decisions made after the audit (main thread)

The first audit round raised 22 objections. The main thread fixed them as follows. None of the fixes changes a user decision.

- **Frame kinds and caps.** Kinds have values 1 to 5, with a table of direction, body encoding and largest body. A length over the kind's maximum, or an unknown kind, is a bad frame.
- **Unusable replies.** The adapter logs and drops replies with an unmatched id or a wrong `DATA` length, and the connection stays open.
- **Validation failures.** A body that fails Zod, a non-hello first frame, or an unparseable frame reports `unknown_bridge`, then the adapter closes and reconnects with backoff. Schemas ignore unknown keys and unknown domain names, and reject unknown `bridge` and `platform` values. The adapter treats an unknown error code as `internal`.
- **Wrong bridge on an endpoint.** A hello naming a different bridge than the endpoint's adapter reports `unknown_bridge`, and the adapter sends no reads.
- **No bridge listening.** A refused TCP connect is not a problem. The adapter stays disconnected, and the viewer shows the install steps.
- **Probe and status rules.** Bridges with a problem are not usable. Probing picks among usable adapters, and a bridge that becomes usable later doesn't replace the live one. With none usable, `state` is `"disconnected"` and `status.adapter` describes the highest-priority problem bridge. The program never probes its own live endpoint, so `busy` means another program instance holds the bridge.
- **Where the shapes live.** The API package defines `status.adapter.bridge` and `problem`, with `problem` as an open enum. `server/` holds only the wire decoders.
- **Splitting reads.** Only `rom` reads are split. RAM reads never are, and a test checks that declared RAM reads fit the caps.
- **In-flight wording.** Ticks during a request that is still within its 250 ms timeout count as an overrunning cycle. Only ticks while a timed-out request is still unanswered count as timeouts. The bridge runs each request handler under `pcall`, so it answers every request it can parse.
- **Cold reads.** A cold read sends two requests in sequence, and the second reply is the cycle's sample. The exclusion now reads "two requests in every cycle".
- **Bind address.** `host` is an IP literal or a hostname, and the settings schema rejects wildcard addresses. This amends Config file.
- **Mismatch guidance.** Reload steps point at this program's own bridge copy, and the viewer says whether the loaded bridge is older or newer.
- **Spike fallbacks.** Each open spike now has a fallback decided in the ticket.
- **Wording fixes.** `build` appears in `status.adapter.bridge`, the box read is the whole Gen 3 PC storage, and the game message is described as reporting a ROM change.
- **Rejected objection.** The auditor asked for a glossary entry for "game message". The main thread declined, because it is a wire message and `CONTEXT.md` holds only domain language.
- **Corrected premise.** The auditor said nothing is read without demand. The read loop always reads `status` and the in-battle flag, but the Liveness bullet was reworded anyway.

## Decisions made after the second audit (main thread, owner-approved round)

The runner stopped after two rounds without APPROVE. The owner approved one more round with these fixes, and none of them changes a user decision.

- **Id-0 errors.** An `ERROR` with id 0 is routed by code: `busy` sets that problem, and `bad_frame` is logged. Only errors with a nonzero id fall under the unmatched-id drop rule. A dropped reply that carried the pending id frees the in-flight slot.
- **Hello order.** The adapter checks `bridge` and `protocol` before the full schema, so a protocol difference always gives `protocol_mismatch`, even when a newer hello changed shape.
- **Failures after a valid hello.** These report a new `problem` value, `bridge_error`. A garbled frame closes the socket and the adapter reconnects with backoff. An invalid game body leaves the socket idle. An invalid error body counts as `internal`.
- **Priority order.** The status uses the App form factor order: mGBA, then RetroArch, then BizHawk.
- **Probe connections.** They close right after the hello unless that adapter goes live.
- **`pcall` scope.** The whole bridge step runs under `pcall`. A handler error answers with `internal`, and any other error closes the client connection.
- **Hashes.** `crc32` comes from `emu:checksum(C.CHECKSUM.CRC32)`. `sha1` is sent only for BizHawk cores the spike confirms return SHA-1.
- **`emu.yield()`.** The unsourced documentation claim is gone, and the behaviour stays an open spike item.
- **Port change.** One message covers it: the connection screen's install steps, which begin with loading or reloading the bridge.
- **Two schemas.** The wire schemas in `server/` are strict, and the API package shapes are loose open enums. The program copies only a hello that passed the strict check into `status`.
- **Bridge hosts.** They must be IP literals, with hostnames and wildcards rejected. This amends Config file.
- **Dropped objection.** The claim that cited sections don't exist was dropped on the owner's ruling. They exist in Game identification, Release pipeline, Read loop and App form factor, and so does the v1 script.

## Unaudited edits after round 3

The owner ruled to apply these fixes for the round 3 objections and commit without another audit. The main thread made them, and no auditor has checked them.

- **`unknown_kind`.** It now means a known kind sent in the wrong direction, such as `DATA` sent to the bridge, and the connection stays open. A kind value outside the table stays a bad frame.
- **Clearing `bridge_error`.** An invalid game body leaves the socket open with no reads. The next valid game message on that socket clears `bridge_error` and reads resume. On a new connection, a valid hello and game message clear it. The "like a mismatch" comparison is gone.
- **Mismatch in `status`.** For `protocol_mismatch`, `status.adapter.bridge` holds the step-1 `bridge` and `protocol` fields, with `build` and `emulator` null, so the viewer can say whether the bridge is older or newer.
- **Probe and mismatch connections.** Probe connections close after the hello, whatever it says. The one exception is the bridge `status.adapter` describes while no adapter is usable: with `protocol_mismatch`, the program holds that connection open and idle, so a reload shows as a close. A switch to that adapter reuses the connection. The Excluded entry now reads "closing the held connection on a protocol mismatch".
- **Wrong-bridge hello.** The adapter copies the hello into `status.adapter.bridge`, sends no reads, closes the socket and retries with backoff.
- **Strict enums.** The reason is now the protocol number: a bridge that sends the program's protocol must use exactly these values.
- **`internal` text.** The bridge truncates `message` so an `ERROR` body fits the 4 KiB cap.

## Map note for the master

Amend the map's Notes platform line. The user chose this in the interview (question 1): if the bridge spike finds that Linux BizHawk ships no LuaSocket, BizHawk on Linux is unsupported for now, and Linux stays supported through mGBA and RetroArch. BizHawk has no macOS build.

## Glossary

`CONTEXT.md` gains **Hello** and **Memory domain**.

## Audit

- Round 1: 22 objections, all addressed above.
- Round 2: 13 objections, no APPROVE. The runner stopped, and the owner approved a third round. Twelve were fixed as listed above. One was dropped on the owner's ruling. The Linux BizHawk scope went to the master as a map note.
- Round 3: no APPROVE. The round 2 fixes hold, but the new text has 7 defects. `unknown_kind` is dead code, because an unknown kind is already a bad frame. `bridge_error` after an idle game failure can't be cleared by a hello on the same socket. A mismatched hello never reaches `status`, so the viewer can't say older or newer. The probe close rule and the idle-on-mismatch rule disagree. The socket disposition for a wrong-bridge hello is missing. "Same build" is the wrong reason for strict enums. Lua `internal` text can exceed the 4 KiB error cap. The runner stopped, uncommitted. The owner then ruled to apply the fixes listed under "Unaudited edits after round 3" and commit without a fourth round.

## Runner notes

- The parent master thread ran the Jev audit, and this child skipped it as instructed.
- The commit gate didn't ask the user, per the master's instruction for this child. The master merges, and this branch never merges to `main`.
- The repo has no CI and `wayfinder/v2-rebuild-master` isn't on the remote, so the owner ruled "no CI". The branch is pushed with no PR, and the ticket's `## Answer` lands in the same commit.
- `map.md` is untouched. The Decisions line and the Notes amendment go back to the master.
