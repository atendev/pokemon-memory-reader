# RetroArch probe and batch caps: amendment for spec §17 item 14

Resolves [How is RetroArch probed, and what happens when a batch is too big?](../tickets/026-retroarch-probe-and-batch-caps.md).

The owner settled each choice in a grilling interview on 2026-11-13. When the spec text is next updated, spec §3.3, §3.4, §4.4 and §8.4 will cite this amendment for §17 item 14. This ticket doesn't edit the spec. Points marked *(main thread)* fill in details the interview didn't ask about. The decision report lists them.

## Amendment

1. **Probe.** The RetroArch adapter probes its `adapters.retroarch` endpoint (§9.2, default `127.0.0.1:55355`) by sending one `GET_STATUS` datagram. RetroArch has no hello, so this one command both identifies it and reports content state.
   - A valid reply is `GET_STATUS CONTENTLESS`, or `GET_STATUS PLAYING` or `GET_STATUS PAUSED` followed by `<system>,<basename>`, with `,crc32=<hex>` in 1.22.2 only. The RetroArch adapter spike confirms this format and the system IDs (§15). If the spike finds other status words, it adds them to this list.
   - Any other reply counts as no reply, including one that starts with `GET_STATUS ` but doesn't parse. The adapter logs the first such reply per session, so a RetroArch release that changes the format shows up in the log. *(main thread)*

2. **Probe timeout.** The probe waits 1 s. No reply in that time, or an ICMP port-unreachable error on the socket, means RetroArch isn't running. That isn't a problem, and the adapter handles it like a refused TCP connect (§4.7). The adapter stays disconnected, `status.adapter.problem` stays `null`, and the adapter re-probes on the bridges' reconnect backoff.
   - A RetroArch that starts answering later, for example after it launches or after the user enables network commands, becomes usable at its first valid reply. Under §3.3 it doesn't replace a live adapter.
   - The 1 s probe timeout is separate from the 30 s no-reply disconnect, which applies only once RetroArch is the live adapter (§3.4, §8.6).

3. **Usability.** RetroArch is usable as soon as one valid `GET_STATUS` reply arrives, the same way a bridge is usable after a valid hello. The probe adds no RAM test read and no new `problem` values. For RetroArch, `status.adapter.bridge` and `status.adapter.problem` stay `null`.
   - `CONTENTLESS` gives `state: "no_game"`.
   - Content on a system the program doesn't read (not GB, GBC or GBA) also gives `"no_game"`.
   - With GB, GBC or GBA content, the program reads the header through `READ_CORE_MEMORY` and identifies the game under §5.4 and [How are ROMs keyed and re-identified?](../tickets/014-rom-keying-and-reidentification.md).
   - A core that maps no ROM, such as gpSP, still counts as usable. Its name and species tables are unavailable (§5.5, §5.6). Its header read fails, so whether the game can be identified another way, such as by the 1.22.2 `crc32`, is up to ticket 014. If it can't be, the state is `"unidentified"`.
   - A core that refuses RAM reads gives `"unidentified"`.
   - Priority still follows §3.3. An idle RetroArch beats a BizHawk bridge with a game loaded, the same way an mGBA bridge with no game loaded does, and the viewer's adapter list lets the user switch.

4. **Status while live.** The live RetroArch adapter sends `GET_STATUS` once per second, alongside that tick's batch.
   - Its reply is outside the batch's all-or-nothing rule in point 5. A missing status reply just waits for the next second. *(main thread)*
   - Any reply counts as a reply for the 30 s disconnect rule.
   - `CONTENTLESS` or an unread system moves the state to `"no_game"`. How a change of content becomes a game change is left to ticket 014.

5. **RetroArch batches.** The RetroArch adapter merges ranges per §8.4 and then splits every range, RAM included, into chunks of at most 16384 bytes. Each chunk is one `READ_CORE_MEMORY` datagram. This changes §4.4's "never split a RAM read" for RetroArch only. Slices on RetroArch already come from different frames (§3.4), so chunking loses no consistency. The Gen 3 box read, about 33.6 KB, becomes three datagrams. The bridges keep §4.4 as written.
   - The adapter sends every datagram of a batch at once and matches each reply to its chunk by the echoed address and byte count. *(main thread: byte count added)* This replaces §8.4's "one datagram per range" with one datagram per chunk.
   - Before chunking, the adapter also cuts ranges at known descriptor boundaries, so a merged range never asks one datagram to span two listed descriptors. A domain can span several descriptors. Gambatte maps GB WRAM as two, at `0xC000` and `0xD000` (§3.4), so a range merged across `0xD000` is cut there. The adapter holds the boundary list per platform, and the RetroArch spike records each core's descriptors (§15). *(main thread, after audit)*
   - A chunk that still crosses an unlisted boundary gets a short reply under 1.22.2 and fails its decoders under the short-reply rule below. The adapter logs it once per session, so a missing boundary shows up in the log.
   - A batch is complete when every chunk has a reply. If any reply is missing at the 250 ms timeout, the whole batch is a timeout under §8.6. The program keeps the last values, emits nothing, and counts the tick toward `stalled`. The box request follows the same rule with its 1000 ms timeout (§8.3), and its timeouts don't count toward `stalled`.
   - A reply shorter than the chunk, such as 1.22.2 clamping at the end of a memory descriptor, or an error reply fails only the decoders that used that range, as a failed range check does (§4.4). *(main thread: error replies grouped with short replies)*
   - Replies carry no request ID. A late reply for a chunk the current batch also requested can't be told apart from the current one, so it is accepted. It is a real sample of the same range from an earlier frame, which the different-frames rule already allows. This is a RetroArch exception to §8.6's "a late reply is discarded". Late replies that match no chunk of the current batch are still discarded. *(main thread)*
   - The RetroArch spike may still set `minIntervalMs` or a larger merge gap (§8.10, §15). The bridge caps in point 6 don't apply to RetroArch requests, so a larger RetroArch merge gap doesn't affect that check.

6. **Bridge caps are checked at profile load.** The read loop never has to split a merged main batch, because no loaded profile can produce one over the caps.
   - The resolved-profile check (018's amendment, point 3) bounds two requests for the profile: the main batch, with every resource demanded and boxes excluded, and the box request. Each bound covers all the decoders' declared reads (§6.1): static regions, pointer-derived regions at their declared maximum lengths, and the pointer words.
   - **Range count** is the unmerged count. Merging only lowers it.
   - **Bytes** are the sum of the lengths plus the bridge merge gap times (count − 1), since each merge adds at most the gap.
   - A `rom` range larger than the caps is left out of both bounds, because §4.4 already splits it into its own requests.
   - A profile whose main batch or box request exceeds 512 ranges or 64 KiB fails the check like any other resolved-profile error. The error names the request, its totals and the caps. A user replacement that fails is skipped, and the program keeps the built-in profile (018's amendment, point 2).
   - Every demand subset, the pointer-words-first request pair (§8.5) and every cold cycle are subsets of the bound, so they fit too.
   - In CI, every built-in profile runs through the same check, which extends §4.4's per-decoder test to whole profiles.
   - At run time, a bridge request over the caps can only come from a bug. The bridge adapter sends nothing and logs an error naming the request's totals, at most once a minute like other program bugs (§4.5). The read loop handles the tick like a timeout under §8.6. It keeps the last values, emits nothing, counts the tick toward `stalled` (or not, for a box request, as with box timeouts), and tries again next tick. `status.adapter.problem` doesn't change. *(main thread)*
   - The check bounds bridge requests only, with the bridge merge gap. The profile doesn't depend on the adapter, so it runs whichever adapter is live. RetroArch requests have no 512-range or 64 KiB cap. Its 16 KiB datagram limit is handled by chunking (point 5).

## Spec text this replaces

- §3.3. "How RetroArch is probed and when it counts as usable is not set" is replaced by points 1 to 3.
- §3.4 Batching. Point 5 sets chunking, send order, reply matching and timeouts. "Within RetroArch's 16384-byte and one-descriptor limits" becomes cuts at known descriptor boundaries and fixed 16 KiB chunks.
- §4.4. The per-decoder cap test becomes the whole-profile check in point 6. "Never splits a RAM read" applies to bridges only.
- §8.4. "No rule covers a merged batch that exceeds the bridge caps" is replaced by point 6. "RetroArch sends one datagram per range" becomes one datagram per chunk (point 5).
- §8.6. "A late reply is discarded" gains the RetroArch exception in point 5.

## Excluded

- Probing with `VERSION`, or with a `READ_CORE_MEMORY` test read.
- A 3 s probe timeout, and reporting silence as a problem.
- A RAM test read for usability, a new `unreadable_core` problem, and requiring loaded content before RetroArch is usable.
- Splitting an over-cap batch into several requests at run time, and dropping or rotating resources that don't fit.
- Refusing RAM ranges over 16 KiB on RetroArch, and relying on 1.22.2 having no cap.
- Partial decoding of a RetroArch batch, and sending its datagrams one at a time.
- `GET_STATUS` every cycle, or only after read errors.
