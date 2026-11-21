# Decision report: Gen 3 bag decoder and `bag` resource (ticket 064)

Branch `t3/gen3-bag-decoder`, cut from `wayfinder/v2-build-master`. The council ran the Claude seat only. Gemini and GPT seats skipped (out of quota). The Claude seat approved in round 1 with a score of 8.

## What was built

- `server/src/format/gen3/bag.ts`: `gen3Bag`. It declares one pointer region per pocket (slot count times 4 bytes) and a `key` region. Each slot is `struct ItemSlot`, a u16 item ID then a u16 quantity. Item ID 0 is skipped, and quantity 0 and quantities above 99 are kept. Quantities are XORed with the low 16 bits of the key. An unknown item ID keeps its number with a null name.
- `server/src/format/gen3/save.ts`: the `at` helper that moves a profile address by an offset. It moved out of `player.ts` so both decoders share it.
- `server/src/format/gen3/structs.ts`: the `BAG` slot layout.
- `server/src/format/gen3/profile.ts`, `server/src/profile/schema.ts` and `registry.ts`: a typed `gen3Bag` profile block. Other formats take an untyped block until their decoders exist. The registry merges `bag` one level deep.
- `scripts/generate-profiles`: a hand-written `bag` block is written into the profile. A second run leaves `emerald-us-1.0.json` byte-identical (same md5 on two runs).
- Wiring: `Decoder.bag`, `BoundGame.bag`, `declaredRegions`, `bindGame`, the read loop and `SNAPSHOT_TOPICS`, so `GET /api/v2/bag` is served.
- API: `PocketId`, `BagEntry`, `Pocket` and `Bag` types, schemas and sync pairs with `PAIRED` entries, and `bag` in `TOPIC_NAMES`, `ResourceMap` and `resourceSchemas`. `docs/open-enums.md` was regenerated.
- Tests: `bag.test.ts` (empty pocket, full pocket, unknown ID, decryption, quantity 0 and above 99, a skipped empty slot, a keyless profile, region sizes), three loop tests with a `bag-encode.ts` fixture (valid bag with five pockets and decrypted quantities, null pointer 503 `no_data`, HTTP 200), a generator test, two profile schema tests, an inheritance test, and updated caps expectations (35 ranges, `bag` among the declared parts). No ROM bytes are committed.
- Local results: typecheck and lint clean. api 33, server 513, scripts 247 and viewer 51 pass. The one failure is the Lua version check in `server/test/bridge/core.test.ts`, which fails because the host's `lua` is 5.5 and CI uses 5.4.

## Game facts confirmed against pret/pokeemerald (master)

- `struct ItemSlot { u16 itemId; u16 quantity; }`.
- `SaveBlock1`: `bagPocket_Items` 0x560 (30 slots), `KeyItems` 0x5D8 (30), `PokeBalls` 0x650 (16), `TMHM` 0x690 (64), `Berries` 0x790 (46). The counts are `BAG_ITEMS_COUNT` and its siblings in `include/constants/global.h`.
- `SaveBlock2.encryptionKey` is a u32 at 0xAC.
- `src/item.c` `GetBagItemQuantity` returns `gSaveBlock2Ptr->encryptionKey ^ *quantity` on a u16, so only the low 16 bits apply. Item IDs are not encrypted.
- Amendment 017's gate for this fact ("the Gen 3 XOR scope") is now checked against source. The fixture encodes offsets as literals, separate from the profile, so a wrong profile value fails the test.

## Decisions

| # | Question | Options | Choice | Made by |
| --- | --- | --- | --- | --- |
| 1 | What shape does the profile `bag` block take? | Nested per-pocket objects, ten flat keys, or two length-5 arrays | Two arrays, `pocketOffsets` and `pocketCapacities`, in game order. The existing profile value type accepts numbers and number arrays, so no schema widening is needed. A hack that changes one capacity restates one array (amendment 018). | Implementer |
| 2 | Where does the bag get the key offset? | A second `encryptionKeyOffset` in `bag`, or reuse `player.encryptionKeyOffset` | Reuse the player's. The key is one value per save, so one source avoids two copies drifting. | Implementer |
| 3 | One region per pocket or one region over all five? | Five regions plus the key, or one span from the first offset to the last end | Five regions. The five pockets are contiguous in Emerald and the loop merges nearby ranges, while a hack may space them. It adds 12 ranges, well under the 512 cap. | Implementer |
| 4 | How is the optional key declared? | Optional region, or a duplicate region | As in 063, `key` is always declared. A keyless game points it at pocket 0 and decode ignores it. | Implementer |
| 5 | Are the offsets read from pret symbols? | Generator reads them, or hand-written verified values | Hand-written in the definition, as the player block is. Struct offsets are not symbols in the `.sym` file. Each value was checked against pret source in this ticket. | Implementer |
| 6 | Does a quantity of 0 or an empty-looking stack get dropped? | Drop, or keep as stored | Keep as stored per amendment 017 §5. Only item ID 0 is an empty slot. | Implementer (amendment 017) |
| 7 | How does the closed `PocketId` enum reach the snapshot test? | Update the closed-enum snapshot, or leave `bag` out of it | Update it. The diff is one added entry, `bag.pockets[].id`, for a new resource, so no existing enum changed. | Implementer |
| 8 | Who is the audit's Claude seat? | n/a | Haiku, per `council-audit`. Gemini and GPT were skipped on the user's instruction. | Master |

## Audit

Round 1, Claude seat (haiku): APPROVE, score 8. Gemini and GPT seats skipped (out of quota).

| Problem | Seat | Outcome |
| --- | --- | --- |
| A Gen 3 profile file with no `bag` block now fails to load | claude, minor | Declined. This is intended: amendment 017 §6 says Zod makes the keys required so a capacity is never unknown, and 063's `player` block works the same way. Emerald is the only Gen 3 profile and it has the block. |
| A keyless game declares `key` as a duplicate of pocket 0, so one range is requested twice | claude, minor | Declined. The cost is one extra range, and the pattern matches the merged player decoder. |
