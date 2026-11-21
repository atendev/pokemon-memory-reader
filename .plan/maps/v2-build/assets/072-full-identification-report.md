# Full ROM identification: decision report

Ticket: [Full ROM identification](../tickets/072-full-identification.md). Built on spec §5.4 and amendments 014, 020, 022 and 025. Audit: Claude seat only, approved in round 2 with a score of 8. Gemini and GPT seats skipped (out of quota).

## What shipped

- `server/src/identify/signature.ts`: turns a profile's signature words into ROM reads and judges the bytes that come back as `match`, `mismatch` or `unchecked`. A profile that declares none gives `null`.
- `server/src/identify/identify.ts`: the identification job now follows the §5.4 order. Exact hash comes first, then header plus signature, then header alone. It stays one job in the single request slot.
- `server/src/resource/status.ts`: `status.rom.contentName` now comes from the adapter. `status.game.match` is `exact` or `header`.
- `server/src/loop/read-loop.ts`: an exact hash match with a signature mismatch logs a profile error and the ROM still loads.

## Decisions

1. **Which hash wins.** Question: use SHA-1 and CRC32 together or one at a time? Options: OR them, SHA-1 then CRC32 fallback, or SHA-1 only when supplied. Choice: SHA-1 only when supplied, else CRC32 (implementer, after the council seat's minor problem 3). Reason: amendment 014 says "SHA-1 first", and a SHA-1 that matches nothing means a modified ROM.
2. **Adapter that can't read ROM.** The ticket text says the signature fields stay null. Spec §5.4 and amendment 025 §3 say `unchecked` means a word couldn't be read, "as when the adapter can't read ROM", and `null` means the profile declares none. Choice: follow the amendment (implementer). A hash match on such an adapter reports `unchecked` for a profile with a signature and `null` for one without. The `rom` header fields stay null. Needs the master's eye: the ticket wording and the amendment disagree.
3. **Shared header with a failed signature.** Several profiles can match one header. Choice: a profile whose signature matches wins. An unsigned profile takes the ROM only when no candidate's signature failed or was unreadable (implementer, after the council seat's blocking problem 1). Reason: a patched ROM must not fall to the unsigned profile.
4. **Several equal matches** by hash or header stay `unidentified`, as §5.4 does for header matches.
5. **New internal reason `modified_rom`** on `unidentified`: hash matched nothing while the header matches a base game, or a header match failed or couldn't check its signature. `status.state` is unchanged.
6. **Signature reads.** On a hash match the signature words go in the same request as the header. With no hash, the header read comes first and the signature words follow in a second request inside the same job. A pointer or non-ROM signature address counts as unreadable.
7. **Fixtures.** `emeraldMemory` now carries Emerald's three signature words. Loop tests, the status test and the tracer test use Emerald's real CRC32 `1f1c08fb`, since a made-up hash now means a modified ROM.
8. **Left out.** `romKeys` (amendment 014 §2) belongs to the manual-picks ticket and nothing here needs it. Here `contentName` only feeds `status.rom`. The `RHHEXP` scan, manual picks and the RetroArch 2 s re-check stay with their own tickets.
9. **mGBA CRC32 only.** Already true: `bridges/src/mgba-shim.lua` sets `sha1 = nil`, and `server/test/bridge/mgba-build.test.ts` asserts it on the game message. The tracer test sends CRC32 only through the fake bridge.

## Tests

Hash match (CRC32, SHA-1, uppercase), header-only match, signature match, signature mismatch (on hash and on header), profile with no signature, unreadable ROM, modified ROM, shared header, and four `/status` cases through the real server and fake bridge. Server suite: 523 pass, 1 fail. The failure is the host Lua 5.5 version check in `server/test/bridge/core.test.ts`, known and ignored.

## Minor problems declined

None.
