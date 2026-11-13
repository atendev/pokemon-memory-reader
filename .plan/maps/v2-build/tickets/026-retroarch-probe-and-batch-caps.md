---
type: grilling
assets: [../assets/026-retroarch-probe-and-batch-caps.md, ../assets/026-retroarch-probe-and-batch-caps-report.md]
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794582779
claimed_at: 2026-11-13T15:12:59Z
---

# How is RetroArch probed, and what happens when a batch is too big?

## Question

Spec §17 item 14. Decide how the RetroArch adapter probes UDP 55355 and when it counts as usable, and what the read loop does when one cycle's merged batch exceeds the 512-range or 64 KiB caps.

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

The owner decided this in a grilling interview on 2026-11-13. The full amendment, which spec §3.3, §3.4, §4.4, §8.4 and §8.6 will cite, is in [026-retroarch-probe-and-batch-caps.md](../assets/026-retroarch-probe-and-batch-caps.md).

- The RetroArch adapter probes with one `GET_STATUS` datagram and waits 1 s. Silence or ICMP port-unreachable means RetroArch isn't running. That isn't a problem, and the adapter re-probes on the bridges' backoff.
- RetroArch is usable on any valid `GET_STATUS` reply. `CONTENTLESS` or a system the program doesn't read gives `no_game`. A ROM-less core such as gpSP loses name and species tables. A core that refuses RAM reads gives `unidentified`. There are no new `problem` values.
- While live, the adapter sends `GET_STATUS` once per second. Ticket 014 still owns how a game change is identified.
- RetroArch batches cut ranges at known descriptor boundaries, then into 16 KiB chunks, RAM included. Each chunk is one datagram. The adapter sends them all at once and matches replies by echoed address and length. A missing reply at 250 ms makes the whole batch a timeout. A short or error reply fails only that range's decoders.
- The resolved-profile check bounds each profile's bridge main batch and box request against 512 ranges and 64 KiB. A profile over the caps fails to load, and CI checks every built-in. The read loop never splits a batch at run time. A runtime over-cap is a bug, handled like a timeout.

Why: one command identifies RetroArch and reports its content state, and a load-time bound turns the caps into a guarantee instead of a runtime branch. Excluded: probing with `VERSION` or a test read, a 3 s probe, reporting silence as a problem, an `unreadable_core` problem, splitting or dropping resources at run time, refusing RAM ranges over 16 KiB, partial RetroArch decodes, and sending datagrams one at a time.
