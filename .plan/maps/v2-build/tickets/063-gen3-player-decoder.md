---
type: task
blocked_by: [062]
claimed_by: wfm-v2-build-master-1795256075
claimed_at: 2026-11-21T10:45:51Z
---

# Gen 3 player decoder and `player` resource

## What to build

Build the `player` resource for the Gen 3 data format on Emerald, following spec §7.6 and [the 017 amendment](../assets/017-player-and-bag-shapes.md): `{ name, trainerId, secretId | null, money, badges, location, playTime }`. Per-game values live in a profile `player` block, and `generate:profiles` writes the Emerald addresses from the pinned pret symbols.

Emerald stores money (and, in the bag ticket, item quantities) XORed with the save encryption key in `gSaveBlock2`. Confirm the exact fields and the badge flag ids in pokeemerald before coding. `location.section` and the other location fields follow the 017 amendment and the location tables from [Gen 3 location names reference data](./034-gen3-location-names.md). `GET /api/v2/player` joins the app, the `player` topic joins the topic list, and the API schemas follow the sync rules from [Zod-free declarations](./057-zod-free-api-declarations-build.md): a type, a sync pair and a `PAIRED` entry.

## Acceptance criteria

- `GET /api/v2/player` returns a `Player` that parses with the real schema on synthetic Emerald memory, with money decrypted and eight badges.
- The decoder tests cover a moved `gSaveBlock1Ptr` and a null pointer (a 503 `no_data` through the existing codes).
- The Emerald profile gains its `player` block from the generator, and the profile is regenerated with a stable second run.
- Type, schema and sync tests are in place. No ROM bytes are committed.

## Handoff

Branch `t3/gen3-player-decoder`. Audit round so far: 0 (no council run yet). Nothing typechecked or tested yet. Run `bun install --frozen-lockfile` first.

**Done (in the `wip:` commit):**
- `api/`: `Badge`, `MapLocation`, `PlayTime`, `Player` types, schemas and sync pairs, `player` in `TOPIC_NAMES`, `ResourceMap`, `resourceSchemas`. Still to do: run biome (import order in `sync.test.ts`), update `api/src/__snapshots__/schemas.test.ts.snap` and any open-enum test.
- `server/src/format/gen3/profile.ts`: `gMapHeader` address and `gen3Player` block `{ badgeFlags[8], moneyOffset, flagsOffset, encryptionKeyOffset? }`. `profile/schema.ts` has a file-level `player` block, full schema gen3 typed and other formats untyped, and `registry.ts` merges `player`.

**Left, in order:**
1. Generator: `definitions.ts` gains `gMapHeader` and a hand-written `player` block, with `definition.ts` and `build.ts` writing it. Emerald values: `badgeFlags` 0x867 to 0x86E, `moneyOffset` 0x490, `flagsOffset` 0x1270, `encryptionKeyOffset` 0xAC. Run `bun run generate:profiles` twice (network works) and check it is stable.
2. `server/src/reference/badges.ts`: hand-kept names by art version (Emerald: Stone, Knuckle, Dynamo, Heat, Balance, Feather, Mind, Rain) with a length test. Hack profiles give `name: null`.
3. `server/src/format/gen3/player.ts`. Save block 2: name 0x00 (7 chars), trainerId u16 0x0A, secretId u16 0x0C, hours u16 0x0E, minutes 0x10, seconds 0x11, frames 0x12, key u32 at the profile offset (one region 0 to key+4). Save block 1: x, y s16 at 0x00 and 0x02 (no border offset, confirmed in pret `overworld.c`), mapGroup u8 0x04, mapNumber u8 0x05, money u32 XOR key, flag bytes. `gMapHeader+0x14` is `regionMapSectionId`, with the name from `names.locations`. Fail on minutes, seconds or frames above 59.
4. Wire `Decoder.player`, `gen3Decoder`, `bindGame` and `declaredRegions` (update `registry.test.ts:232`), `read-loop.ts` (`bound[topic]` for party and player, `DECODED`) and `app.ts` `SNAPSHOT_TOPICS`.
5. Tests: decoder (moved `gSaveBlock1Ptr`, null pointer giving 503 `no_data`, money decrypted, eight badges), a `GET /api/v2/player` test in `read-loop.test.ts` style with a `test/gen3/player-encode.ts` helper, a generator stable-run test, and a caps test.
6. `bun run typecheck`, biome and `bun test` (ignore the Lua 5.5 failure in `bridge/core.test.ts`). Then council audit (Claude seat only), report to `assets/063-gen3-player-decoder-report.md`, unslop, close timing, commit, push, return DONE.

Pret facts (confirmed from pokeemerald master): flag IDs are `SYSTEM_FLAGS (0x860) + 7..0xE`, `FLAGS_COUNT` 300 bytes, `gMapHeader` is at 0x02037318.
