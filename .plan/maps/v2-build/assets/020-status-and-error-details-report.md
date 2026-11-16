# Decision report: What fills the unset status and error details?

Ticket: [What fills the unset status and error details?](../tickets/020-status-and-error-details.md). Amendment: [020-status-and-error-details.md](./020-status-and-error-details.md).

## How this ran

The run used auto-mode, as the wayfinder-master asked. The main thread wrote each round's questions, options and recommendations. One grilling subagent on `sonnet` stood in for the owner and took every decision. It ran no skill. The owner answered nothing in this run.

The main thread first sent round 1 to the owner with AskUserQuestion. The master then said the run is auto-mode, so those answers were dropped and the same four questions went to the grilling subagent. It took the same options.

One auditing subagent on `haiku` checked the amendment. It returned APPROVE in round 4 of 5.

## Decisions

Each decision lists the question, the options, the choice and who made it. The audit verdict for all of them is APPROVE in round 4.

1. **Code for a cold read that gets no data while a game is loaded.** The options were one new code `no_data`, two codes `timeout` and `no_data`, or reusing `stalled`. The grilling subagent chose `no_data` for a timeout, an empty or failed read, and a demanded resource that has never decoded a value. A client handles all three the same way, and `status` in the body carries `stalled`.

2. **SSE 400 body and the error shape.** The options were one shape `{ error: { code, message }, status }` for every error with code `invalid_topics`, a 400 without `status`, or one shape plus a `topics` array. The grilling subagent chose one shape with `invalid_topics` and a message that lists the known topics. It rejected the `topics` array as a second contract to keep stable.

3. **`status.rom` with no ROM.** The options were `rom: null` or an object with every field null. The grilling subagent chose `rom: null` when the adapter reports no ROM. It added that the header fields must be nullable for an unreadable header. That replaces "status always carries rom".

4. **Other `status.adapter` fields.** The options were none, adding `endpoint`, or adding `endpoint` and `pinned`. The grilling subagent chose none. The adapter-list route owns endpoints and pinning. `stalled` is false when `adapter` describes a problem bridge.

5. **Header field nullability per platform.** The options were GBA `title`, `gameCode` and `revision` with GB `gameCode` always null, or a GB `gameCode` from the CGB manufacturer code. The grilling subagent chose the first. The manufacturer code isn't always present, and no key uses it.

6. **Fields added to `rom`.** The options were `platform`, `globalChecksum` and `contentName`, only the first two, or none. The grilling subagent chose all three, with `platform` as a closed enum. A new platform needs new header parsing, so adding one is a spec change anyway.

7. **The `title` string.** The options were a 15-byte GB read on CGB-flagged ROMs and 16 bytes otherwise, an always-16-byte read, or an 11-byte CGB read. The grilling subagent chose the 15-byte rule. It cuts at NUL, maps bytes outside `0x20`-`0x7E` to `?`, trims trailing spaces, and returns `""` for an empty readable title. A 16-byte read takes in the CGB flag byte, and an 11-byte read cuts `POKEMON YELLOW` to `POKEMON YEL`.

8. **Error `message`.** The options were fixed English text with no stability promise, or text that is part of the contract. The grilling subagent chose fixed English text. Clients branch on `code`.

9. **Title and key escaping.** In round 2 the grilling subagent added a note that the title is the last part of every header key. The main thread pointed out that amendment 014 escapes `%` and `:` in `<title>` and puts `:name:<contentName>` after it on RetroArch. The grilling subagent withdrew the note. The amendment says `status.rom.title` is the unescaped string and the key escapes it per 014.

10. **Boxes with no cache.** The options were 503 `no_data` or 200 with `readable: false`. The grilling subagent chose `no_data`. `readable: false` means the program read the box and this adapter can't read it.

11. **`rom` for RetroArch content on a system the program doesn't read.** The options were an object with `platform: "other"`, or `rom: null` because the state is `no_game`. The grilling subagent chose the object. `rom` follows what the adapter reports, and amendment 026's `no_game` state stays.

12. **503 precedence.** The options were a fixed order, or no stated order. The grilling subagent chose `disconnected`, `no_game`, `unidentified`, `unsupported`, then `no_data`.

## Main-thread details

The interview didn't ask about these. The main thread wrote them, and the auditor checked them.

- For `/boxes/:n`, the `:n` check runs after `unsupported` and before `no_data`. That overrides §7.2's "the 503 checks run before `:n` validation" for `no_data` only, so an invalid `:n` never starts a box read.
- Interfaces 004 changes. `UnavailableCode` gains `no_data`, and `buildStatus` returns `rom: null` when `AdapterState.game` is null.

## Audit rounds

1. Three problems. The report link pointed at a file not yet in the diff. The main thread kept the link because this report lands in the same commit. Item 3 hid that it overrides §7.2, and the main thread named the override. A claim about `stalled` had no cited evidence, and the main thread cited §8.6.
2. One problem. "A paused emulator shows `stalled: true`" went beyond what §8.6 says. The main thread cut the sentence.
3. One problem. "Leaves it `false`" was wrong while a stall is already on. The main thread changed it to "doesn't set it".
4. APPROVE.

## Gates skipped

The runner's commit gate question was skipped. The master's brief says to commit every time. The owner's interview was replaced by the grilling subagent under auto-mode.
