# Decision report: How is RetroArch probed, and what happens when a batch is too big?

Ticket: [026](../tickets/026-retroarch-probe-and-batch-caps.md), a grilling ticket for spec §17 item 14. The main thread interviewed the owner in this thread over two rounds. The amendment is in [026-retroarch-probe-and-batch-caps.md](./026-retroarch-probe-and-batch-caps.md).

The main thread asked every question and gave every recommendation. The owner made the interview decisions and took the recommendation each time. The main thread filled in smaller details the interview didn't cover, and a haiku auditor checked the write-up.

## Round 1

| Question | Options | Choice | Decided by |
|---|---|---|---|
| What does the probe send to UDP 55355? | `GET_STATUS` only; `VERSION` then `GET_STATUS`; a `READ_CORE_MEMORY` test read | `GET_STATUS` only (recommended) | Owner |
| How long does the probe wait, and what does silence mean? | 1 s, silence means not running; 3 s like the hello timer; silence reports a problem | 1 s. Silence or ICMP port-unreachable is handled like a refused TCP connect (recommended) | Owner |
| When does RetroArch count as usable? | Any valid `GET_STATUS` reply; a valid reply plus a RAM test read with a new `unreadable_core` problem; only with content and a working read | Any valid `GET_STATUS` reply, with no new problem values (recommended) | Owner |
| What happens when a cycle's merged main batch exceeds 512 ranges or 64 KiB? | Check at profile load; split at run time by resource; drop resources that don't fit | Check at profile load. An over-cap profile fails to load, CI checks the built-ins, and nothing is split at run time (recommended) | Owner |

## Round 2

| Question | Options | Choice | Decided by |
|---|---|---|---|
| How does RetroArch handle a range over 16 KiB, or one cut short? | Chunk every range at 16 KiB; chunk only ROM and refuse big RAM ranges; ask for the full length anyway | Chunk every range, RAM included. A short reply fails only that range's decoders (recommended) | Owner |
| How are a batch's datagrams sent, and what if replies are missing? | All at once, all-or-nothing; all at once with partial decode; one at a time | All at once. Any missing reply at 250 ms makes the batch a timeout (recommended) | Owner |
| How often does the live adapter send `GET_STATUS`? | Once per second; every cycle; only after read errors | Once per second. Game-change identification stays with ticket 014 (recommended) | Owner |

## Details the main thread filled in

| Question | Choice | Decided by |
|---|---|---|
| Which replies count as valid? | `GET_STATUS CONTENTLESS`, `PLAYING` or `PAUSED` with `<system>,<basename>[,crc32=…]`. Anything else counts as no reply, and the first one per session is logged. The spike may add status words | Main thread, after audit objection 7 |
| Does a missing live `GET_STATUS` reply fail the batch? | No. It waits for the next second, and any reply counts toward the 30 s disconnect rule | Main thread |
| How are replies matched to chunks? | By echoed address and byte count | Main thread |
| What happens to error replies? | They fail only the decoders that used that range, the same as a short reply | Main thread |
| What about a late reply, since RetroArch replies carry no ID? | One that matches a chunk of the current batch is accepted as a sample from an earlier frame. This is a RetroArch exception to §8.6. Others are discarded | Main thread, §8.6 exception added after audit objection 4 |
| What happens to the one-descriptor limit under fixed 16 KiB chunks? | Before chunking, the adapter cuts ranges at a per-platform list of known descriptor boundaries, such as Gambatte's `0xD000` WRAM split. The spike records each core's descriptors. A chunk that crosses an unlisted boundary fails under the short-reply rule and is logged once | Main thread, after audit objection 5 and the round 2 objection |
| How is the profile-load bound computed? | Unmerged range count. Bytes are the sum of lengths plus the bridge merge gap times (count − 1). `rom` ranges over the caps are excluded because §4.4 splits them. The bound covers bridge requests only | Main thread, scoped to bridges after audit objection 1 |
| What if a bridge request over the caps happens at run time anyway? | It is a bug. The adapter sends nothing, logs it at most once a minute (§4.5), and handles the tick like a timeout. `status.adapter.problem` doesn't change | Main thread, after audit objection 3 replaced an `internal` problem report |
| How is a gpSP game identified when it has no ROM header? | Ticket 014 decides. If nothing identifies it, the state is `"unidentified"` | Main thread, after audit objection 2 |

## Audit

The haiku auditor's first pass did not approve. It raised nine objections:

1. The RetroArch merge gap could break the bound.
2. The "unidentified" rule had a condition the owner never chose.
3. An `internal` report contradicted the null `problem`, and the tick after a runtime over-cap wasn't defined.
4. The late-reply exception wasn't listed against §8.6.
5. The replace list missed §8.4's "one datagram per range" and the one-descriptor limit.
6. The paused-RetroArch wording contradicted "silence means not running".
7. The set of valid status words was left open.
8. The report file was missing.
9. Some section cites were unverified.

The main thread fixed every point. The report was written after the audit, as the workflow requires.

In round 2, the auditor confirmed the first eight fixes and found one more problem. Gambatte maps GB WRAM as two descriptors, so a range merged across `0xD000` would fail on every tick. The main thread added cuts at known descriptor boundaries.

In round 3, the auditor asked for one word. "Never span two descriptors" overstated the guarantee, because the next bullet allows unlisted boundaries, so it now says "two listed descriptors".

Round 4 verdict: APPROVE.

## Workflow notes

- The master thread's instructions replaced the step 5 commit question with "commit every time", so the owner wasn't asked at the commit gate.
- `map.md` was left unchanged. The master adds the Decisions line.
- The Jev audit ran in the parent session.
