# Decision report: Gen 3 player decoder and `player` resource (ticket 063)

Branch `t3/gen3-player-decoder-2`, cut from the earlier branch at `15a03b9`, which was based on `wayfinder/v2-build-master`. The council ran the Claude seat only. Gemini and GPT seats skipped (out of quota). The Claude seat approved in round 1 with a score of 8.

## What was built

- `server/src/format/gen3/player.ts`: `gen3Player`. It declares five regions: `identity` (save block 2, 0x13 bytes), `position` (save block 1, 6 bytes), `money` (4 bytes at the profile offset), `flags` (the bytes holding the badge flags) and `section` (`gMapHeader` + 0x14), plus a `key` region. Save block regions are pointer regions, so a moved `gSaveBlock1Ptr` or `gSaveBlock2Ptr` is followed by the existing pointer logic.
- `server/src/format/gen3/structs.ts`: the `PLAYER` layout constants.
- `server/src/reference/badges.ts`: hand-kept English badge names by art version, with a length test.
- `server/src/format/gen3/profile.ts` and `server/src/profile/schema.ts`: the `gMapHeader` address key and a typed `gen3Player` profile block. Other formats take an untyped block until their decoders exist. The registry merges `player` one level deep, and a null key drops an inherited one.
- `scripts/generate-profiles`: `gMapHeader` joins the address list and a hand-written `player` block is written into the profile. The checked-in symbol excerpt gained `gMapHeader`. A second run of `generate:profiles` leaves the profile byte-identical.
- Wiring: `Decoder.player`, `BoundGame.player`, `declaredRegions`, `bindGame`, the read loop (`DECODED`, `bound[topic]`) and `SNAPSHOT_TOPICS`, so `GET /api/v2/player` is served. `docs/open-enums.md` was regenerated for the new topic.
- API: `Badge`, `MapLocation`, `PlayTime` and `Player` types, schemas and sync pairs, and `player` in `TOPIC_NAMES`, `ResourceMap` and `resourceSchemas` (done in the earlier `wip:` commit).
- Tests: `player.test.ts` (12), four loop tests with a `player-encode.ts` helper (synthetic save, moved pointer, null pointer 503 `no_data`, HTTP 200), a generator test, three profile schema tests, an inheritance test, and updated caps expectations (23 ranges, three declared parts). No ROM bytes are committed.
- Full suite: 784 pass, 1 fail. The failure is the Lua version check in `server/test/bridge/core.test.ts`, which fails because the host's `lua` is 5.5. CI uses 5.4. Typecheck and `biome ci` pass.

## Decisions

| # | Question | Options | Choice | Made by |
| --- | --- | --- | --- | --- |
| 1 | One big save block region or several small ones? | One region from 0 to the key, or one region per field group | Several small regions. The plan merges ranges within the adapter's gap, so reads stay cheap, and each region is only as large as the fields it needs. | Implementer |
| 2 | How is the optional key declared, since a region name can't be optional? | Optional region key, a second decoder, or a duplicate region | `key` is always declared. A game with no `encryptionKeyOffset` points it at the money word and decode ignores it. | Implementer |
| 3 | Where do the offsets and badge flag IDs live? | Decoder constants, or the profile block | The profile `player` block, as amendment 017 §6 says. Values are hand-written in the generator definition from pokeemerald (flags 0x867 to 0x86E, money 0x490, flags 0x1270, key 0xAC) and `gMapHeader` comes from the symbol file. | Implementer |
| 4 | How is money kept unsigned after the XOR? | Plain XOR, or `>>> 0` | `>>> 0`, since JavaScript's `^` returns a signed 32-bit value and money can exceed 2^31 with a large key. A test covers it. | Implementer |
| 5 | What is `section` when the table has no name? | `null` section, or `{ id, name: null }` | `{ id, name: null }`. The ID is the raw stored byte and matches `met.location.id`, as amendment 017 §4 asks. | Implementer |
| 6 | What happens when minutes, seconds or frames exceed 59? | Clamp, or fail the resource | Fail the resource. The schema bounds them, and a value out of range means the game is mid-write or the memory isn't a save block. | Implementer |
| 7 | Badge names for hack profiles? | Inherit the art version's names, or null | `name: null` for `kind: "hack"`, as amendment 017 §3 says. | Implementer |
| 8 | Are `x` and `y` signed? | u16, or s16 | s16, read as an unsigned word and converted. No border offset is added. | Implementer |
| 9 | Who is the audit's Claude seat? | n/a | Haiku, per `council-audit`. Gemini and GPT skipped on the user's instruction. | Main thread |

## Audit

Round 1, Claude seat (haiku): APPROVE, score 8. Gemini and GPT seats skipped (out of quota).

| Problem | Seat | Outcome |
| --- | --- | --- |
| The offsets and badge flag IDs are hand-typed constants, not read from pret symbols | claude, minor | Declined. Symbols exist only for addresses. Struct offsets and flag IDs are not symbols, so the ticket's "from pinned pret" can only mean confirmed against the pinned source. They were checked against pokeemerald, and the definition comment names each one. |
| The generator test compares literals to the same definition, and its stability check is only determinism | claude, minor | Declined. The committed profile is compared by the existing "matches the committed file" test, and a real second `generate:profiles` run gave identical bytes. |
| The ticket's Handoff section is stale | claude, minor | Declined. The resolution commit deletes that section. |

Minor problems declined: 3.
