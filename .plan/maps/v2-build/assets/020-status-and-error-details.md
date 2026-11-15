# Status and error details: amendment for spec §17 item 8

Resolves [What fills the unset status and error details?](../tickets/020-status-and-error-details.md).

This ticket ran in auto-mode on 2026-11-15. A grilling subagent stood in for the owner, took each decision below, and an auditing subagent checked the result. When the spec text is next updated, spec §7.2, §7.4, §8.2 and §8.3 will cite this amendment for §17 item 8. This ticket doesn't edit the spec. Points marked *(main thread)* fill in details the interview didn't ask about. The [decision report](./020-status-and-error-details-report.md) lists every decision.

## Amendment

1. **Error body.** Every error response has one shape, `{ error: { code, message }, status }`, where `status` is the current status resource. That covers the `503` codes, the `404` `not_found` and the SSE `400`. The API package exports one error schema.
   - `message` is fixed English text per code, written for people. It carries no stability promise. Clients branch on `code`, and the API docs must say so.
   - `code` stays an open enum (§7.11).

2. **`no_data` (503).** A new code for a GET while a game is loaded, the resource is supported, and the resource has no value yet:
   - a cold read that times out (§8.2),
   - a cold read that returns nothing usable: a decode or validation failure, a dropped reply, or a bridge error,
   - a demanded resource that has never decoded a value.
   One code covers all three, because a client does the same thing either way: it retries or subscribes. The `status` in the body carries `adapter.stalled`, which turns true after 1 s of consecutive read timeouts (§8.6). A decode failure or a single timeout doesn't set it, so `stalled` tells repeated silence apart from one bad read.
   - **Boxes.** `/boxes` and `/boxes/:n` with no cached value, whose first box read times out or returns nothing, also get `no_data`. A stale cache still wins over a timeout (§8.3). `readable: false` keeps its meaning: the program read the box and it can't be read on this adapter, such as Gen 1-2 SRAM without access.
   - The stream holds the topic, as §7.3 says. `no_data` never appears on the stream.

3. **503 precedence.** One GET checks, in order: `disconnected`, `no_game`, `unidentified`, `unsupported`, then `no_data`. A client never sees `no_data` when the state already explains the missing data. For `/boxes/:n`, the `:n` check (`404 not_found`) runs after `unsupported` and before the read. The four state codes still come before `:n` validation. `no_data` is the one 503 that comes after it, which overrides §7.2's "the 503 checks run before `:n` validation" for `no_data` only. `no_data` needs a box read, and an invalid `:n` should never start one. *(main thread)*

4. **SSE `400`.** When `topics` is missing or names no known topic, the route returns `400 { error: { code: "invalid_topics", message }, status }` before the stream opens. The message lists the known topics. There is no separate machine-readable topic list in the body.

5. **`status.rom`.** It describes what the adapter reports, not the program's `state`.
   - `rom` is `null` when the adapter reports no ROM: disconnected, a null bridge game message, a bridge `no_game` error, or RetroArch `CONTENTLESS`. This replaces "status always carries rom" from [Game identification](../../v2-rebuild/tickets/009-game-identification.md).
   - `rom` is an object whenever the adapter reports content, whatever the state. That includes `no_game` while ROM tables load, `unidentified`, and RetroArch content on a system the program doesn't read. Amendment 026 gives that last case `state: "no_game"`, which stays, and its `rom` has `platform: "other"`. "No ROM" and "a ROM the program can't read" stay distinguishable.

6. **`rom` shape.**

   ```ts
   rom: {
     platform: "gb" | "gba" | "other",   // closed enum, matches the wire
     title: string | null,
     gameCode: string | null,            // GBA only
     revision: number | null,
     globalChecksum: string | null,      // GB only, 4 lowercase hex digits
     crc32: string | null,               // as §7.4 and amendment 014
     sha1: string | null,
     contentName: string | null,         // RetroArch only
     expansion: { version: string, tagged: boolean } | null,  // §5.7, unchanged
   } | null
   ```

   - **GBA, header readable.** `title`, `gameCode` (4 ASCII characters at `0xAC`-`0xAF`) and `revision` (the software version byte at `0xBC`, an integer) are set. `globalChecksum` is null.
   - **GB, header readable.** `title`, `revision` (the mask ROM version byte at `0x14C`, an integer) and `globalChecksum` (`0x14E`-`0x14F`) are set. `gameCode` is always null. The CGB manufacturer code isn't reliably present, and no identification or key uses it.
   - **Header unreadable** (amendment 014's `header: null`, as with RetroArch's gpSP core) **or `platform: "other"`.** `title`, `gameCode`, `revision` and `globalChecksum` are all null.
   - `contentName` is RetroArch's content name per amendment 014, null for the bridges, and null when RetroArch reports `UNKNOWN`.
   - `rom.platform` is closed, a deliberate exception next to the open `code` and `dataFormat`. A new platform needs new header parsing, so adding one is a spec change anyway.

7. **`rom.title`.** The header keys in amendment 014 reuse this string.
   - GBA reads the 12 bytes at `0xA0`-`0xAB`.
   - GB reads the 16 bytes at `0x134`-`0x143`. When the CGB flag byte at `0x143` has bit 7 set, it reads only the 15 bytes at `0x134`-`0x142`.
   - Cut at the first NUL. Replace every byte outside `0x20`-`0x7E` with `?`. Trim trailing spaces. The bytes are read as ASCII, never through the game charmap.
   - A readable header that gives an empty result is `""`. `null` means only that the header couldn't be read.
   - Examples: `POKEMON RED`, `POKEMON YELLOW`, `POKEMON_GLDAAUE` (Gold carries its manufacturer code in the title), `PM_CRYSTAL`.
   - `status.rom.title` is the unescaped string. The header key escapes `%` and `:` in it as amendment 014 says.

8. **`status.adapter`.** The `...` closes. The object is exactly `{ id, stalled, bridge, problem }`.
   - Endpoints, pinning and the other adapters belong to the adapter-list route from [Which routes serve the viewer's controls and info?](../tickets/021-viewer-control-routes.md).
   - When `adapter` describes a problem bridge while `state` is `"disconnected"`, `stalled` is `false`. No reads run on that bridge.
   - Later fields can be added without a breaking change (§7.1).

## Why

One error shape and one "no value yet" code keep the API package to one error schema and one retry rule. `status` already explains the cause. Keying `rom` on what the adapter reports, not on `state`, separates "no ROM", "ROM tables loading" and "a ROM the program can't read" without new states. The title rule follows the GB header's documented layouts: the 15-byte CGB read drops the flag byte and keeps the full `POKEMON YELLOW`.

## Excluded

- Separate `timeout` and `no_data` codes, and reusing `stalled` as an error code.
- A 400 body without `status`, and a machine-readable `topics` array in the 400.
- An all-null `rom` object while no ROM is loaded.
- A GB `gameCode` from the CGB manufacturer code.
- A 16-byte GB title read on CGB-flagged ROMs (it takes in the flag byte), and an 11-byte read (it truncates `POKEMON YELLOW`).
- `endpoint` and `pinned` on `status.adapter`.
- Message text as part of the contract.

## Interfaces 004

`UnavailableCode` gains `no_data`. `buildStatus` builds `rom` from `AdapterState.game` and the program's header read, and returns `rom: null` when `game` is null. The bridge's `GameInfo` has no `contentName`. RetroArch supplies it through amendment 014's `AdapterContent`. *(main thread)*
