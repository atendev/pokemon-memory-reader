# Manual ROM picks: decision report

Ticket: [Manual ROM picks](../tickets/074-manual-picks.md) (task).

## Run

- The parent wayfinder-master session ran the Jev audit, so this child skipped it.
- The first thread built the code and stopped at the context limit before tests and the audit. This thread continued from the handoff on a new branch and wrote the tests.
- Council: the Gemini and GPT seats were out of quota (`n/a`), so one Claude seat (Haiku) judged. It disapproved in round 1 (7) and round 2 (6), then approved in round 3 (8). Both disapprovals were blocking problems in `pick-store.ts`, and both were fixed.
- The master's overrides replaced the runner's commit gate, CI steps and map edit. This report is committed with the work, and the branch never merges.
- `bun test`: 1318 pass, 1 fail. The failure is the known Lua version check, which sees Lua 5.5 on this host. `bun run lint` and `bun run typecheck` are clean.

## Decisions

| # | Question | Options | Choice | Made by | Audit |
|---|---|---|---|---|---|
| 1 | Where do the pick keys come from? | The client sends one; the server derives it | The server derives it from the loaded ROM (`romKeys`). The request carries only `profileId` and `scope`. | Ticket, 021 | Accepted |
| 2 | Which keys does a ROM get? | One key; every key the signals allow | SHA-1 and CRC32 when given, SHA-1 first. Else a header key, ending in the content name on RetroArch. Else `name:<platform>:<name>`. `%` and `:` escape in titles and names only. | 014 item 2, implementer | Accepted |
| 3 | How are picks stored? | Settings file; own file | `<data folder>/manual-picks.json`, Zod-checked, re-read and merged on save, atomic rename, `.bad` quarantine for a malformed or other-version file. | Spec §9.6, 014 item 5 | Accepted |
| 4 | When does the lookup run? | Before automatic identification; after it | After it leaves the ROM unidentified. An automatic match is never overridden. | 014 item 4 | Accepted |
| 5 | What does a base pick need? | Any profile; a hash, a header match and a passing or absent signature | The 014 item 3 conditions. Eligibility needs a second signature read when a hash is present. Several eligible profiles with entries stay unidentified. | 014 item 3, implementer (second read) | Accepted |
| 6 | What if a pick has no key or the file write fails? | Refuse it; apply it for the session | Apply it for the session. The reply says `saved: false` with reason `no_key` or `write_failed`. | Implementer | Accepted |
| 7 | Where does the session-only pick live? | Only in the store; also on the session | On the loop session, so re-identifying the same ROM keeps it. The store also keeps failed writes in a per-key overlay, so a later successful write of another key can't drop them. | Implementer, after round 1 and 2 problems | Fixed, then APPROVE in round 3 |
| 8 | What does changing a pick do to the old one? | Leave both; forget the one that applied first | Forget the entry that applied first, so the old entry can't win the lookup. | Implementer | Accepted |
| 9 | What does the picked profile's signature show? | Hide a failed signature; show it | The pick still loads with `signature: "mismatch"`. | 014 item 4, implementer | Accepted |
| 10 | Is there a `GET /manual-picks`? | Build it here; surface it | Not built. The ticket says "pick and forget", and the list needs a signature read per candidate. Surfaced as a new ticket. | Implementer | Accepted (disclosed) |
| 11 | Is `expansion_rom` wired? | Wire it now; surface it | Not wired. No RHHEXP scan exists yet, so nothing can detect an expansion block. The error code already exists. Surfaced as a ticket blocked by the scan work. | Implementer | Accepted (disclosed) |
| 12 | One route or two? | `POST /manual-picks` only; pick and forget routes | `POST /manual-picks` and `POST /manual-picks/forget`, both write-guarded, as 021 lines 76 and 78 define. | 021 | Accepted |
| 13 | How do the route-table tests handle the new routes? | Skip them when absent; stub the dependency | `everything()` passes a `picks` stub. Rows and a guard-refusal test cover both routes, and the loop never sees a refused write. | Implementer | Accepted |

## Audit rounds

1. DISAPPROVE, 7. Blocking: a successful write replaced the in-memory map with the file and dropped session-only picks from earlier failed writes. Fixed with an unsaved-change list.
2. DISAPPROVE, 6. Blocking: the list dropped a whole failed change when one key overlapped. Fixed with a per-key overlay, and a test for partial overlap.
3. APPROVE, 8. Gemini `n/a`, GPT `n/a`.

## Minor problems declined or rebutted

- `other_platform` skips the pick lookup. Rebutted: `pick()` rejects a platform `other` game as `no_rom` before anything is saved.
- A failed forget write still returns ok. Declined: the store applies the forget for this run and logs the failure, and 021 has no write-failed code for forget.
- The base lookup needs a hash. Rebutted: 014 item 3 says the emulator gave a hash that matched nothing.
- Forget is a separate route. Rebutted by 021.
- `expansion_rom` isn't enforced. Disclosed scope decision, surfaced as a ticket.
- `write()` has no in-process lock, so two overlapping saves can lose one key. Declined: one seat raised it, the window is narrow, the loop issues one pick at a time, and the re-read merge covers other instances, which is what §9.6 asks for. A write queue can come with the `GET /manual-picks` ticket if the viewer makes overlap likely.
