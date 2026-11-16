# Player and bag shapes: amendment for spec §17 item 5

Resolves [What shapes do `player` and `bag` have?](../tickets/017-player-and-bag-shapes.md). Spec sections cite it as "amendment 017 §N".

This was decided in auto mode on 2026-11-16 (UTC). The main thread asked each question with a recommendation, and a grilling subagent stood in for the owner and answered it over three rounds. When the spec text is next updated, spec §7.6, §7.7, §11.6 and §17 item 5 will cite this amendment. This ticket doesn't edit the spec. The [decision report](./017-player-and-bag-shapes-report.md) lists every decision.

## 1. Shapes

```ts
type Player = {
  name: string;
  trainerId: number;          // the visible 16-bit ID
  secretId: number | null;    // null in Gen 1-2
  money: number;
  badges: Badge[];            // 8 in Gen 1 and Gen 3, 16 in Gen 2
  location: MapLocation;
  playTime: PlayTime;
};

type Badge = { id: number; name: string | null; obtained: boolean };

type MapLocation = {
  mapGroup: number | null;    // null in Gen 1
  mapNumber: number;
  x: number;
  y: number;
  section: Ref | null;        // the map section, see §4
};

type PlayTime = { hours: number; minutes: number; seconds: number; frames: number };

type Bag = { pockets: Pocket[] };
type PocketId = "items" | "keyItems" | "balls" | "tmhm" | "berries";
type Pocket = { id: PocketId; capacity: number; items: BagEntry[] };
type BagEntry = { item: Ref; quantity: number };
```

`Ref` is the existing `{ id, name }`. Every key is always present in every generation. `secretId`, `location.mapGroup`, `location.section` and `Badge.name` are `.nullable()`, and each `.describe()` says when the value is null. Optional keys were rejected because §7.10 promises one fixed set of keys.

## 2. Player fields

- **`name`** is decoded through the game's charmap.
- **`trainerId`** is the 16-bit ID the game shows. **`secretId`** is the Gen 3 secret ID and is null in Gen 1-2. One 32-bit Gen 3 ID was rejected.
- **`money`** is the decoded amount. Each decoder does its own conversion. Gen 1 stores BCD, and a nibble above 9 fails the whole `player` resource that cycle. Gen 2 is expected to store a 3-byte big-endian binary integer, not BCD (max 999999). The player fixture's money check gates this (see the table under "Left to build tickets"). Gen 3 stores a 32-bit integer, which Emerald and FireRed XOR with the save's encryption key (§6).
- **`playTime`** is `{ hours, minutes, seconds, frames }` as stored. A total-seconds field was rejected. `hours` is a non-negative integer with no upper bound in the schema, because a hack can change the cap and a schema bound would turn an odd save into a failed response. `.describe()` says Gen 1 stops at 255 hours and Gen 2-3 at 999, so clients must not assume 99. `minutes`, `seconds` and `frames` are bounded 0-59. Gen 1's "maxed" flag is not exposed. The cap shows only as the stored hours.
- **Left out of v2.0:** Game Corner coins, player gender and rival name. They go to a v2.x map, since the spec doesn't list them and adding a field later is additive. The Trainer & bag screen shows no trainer sprite, so gender isn't needed there.

## 3. Badges

- `badges` is an array in game order. `id` is the 0-based index. Gen 2 lists Johto 0-7, then Kanto 8-15, and `.describe()` states that order. A boolean array, a bitmask and a `{ johto, kanto }` object were rejected.
- The decoder owns the bit and flag mapping. Gen 1 and Gen 2 read bitfields. Gen 3 reads event flags, whose IDs differ between Emerald, FireRed and Ruby, so the flag IDs are profile values (§6).
- **Names** come from a short hand-kept English list kept with the reference data and keyed by art version: Kanto for Red, Blue, Yellow, FireRed and LeafGreen, Hoenn for Ruby, Sapphire and Emerald, and Johto then Kanto for Gold, Silver and Crystal. pret has no clean badge-name table in every repo, and art version already picks location names. A test pins each list's length to the badge count for that art version. Hack profiles give `name: null` even when the hack keeps eight badges, because the hack may have renamed them.
- This list is an exception to amendment 019, which takes reference data from the generator reading pret. The reason is that pret has no badge-name table to extract in every repo, and three fixed lists of 8 or 16 names don't justify a parser. It is committed beside the generated reference data and reviewed as a diff, like the growth-curve formulas 019 keeps in code.

## 4. Map location

- `mapGroup` and `mapNumber` are the game's raw map IDs. Gen 1 has one map ID, so `mapGroup` is null there.
- `x` and `y` are the player's position on the current map as the game stores it, in step units, with the origin at the map's top-left. Gen 1 and Gen 2 read the current coordinate bytes. Gen 3 reads the save block 1 position, which the field code updates as the camera moves. The Gen 3 build ticket must confirm with a fixture whether that position includes the engine's border offset, and that it stays live while walking and not only at map load. Pixel and metatile units were rejected.
- `section` is the **map section** the player is in. It gives a display name, so a client needs no map table.
  - **Gen 3 and CFRU:** read `gMapHeader.regionMapSectionId` from RAM, one new symbol per profile. That works for hacks that add maps without a lookup table. `section.id` is the raw stored value, so it matches `met.location.id`, including FireRed's offset section range. Names come from reference data, or from a hack profile's `locations` name table (amendment 016).
  - **Gen 2:** the landmark, the same id space as Crystal's `met.location`. Read the WRAM landmark byte (`wCurLandmark` in pokecrystal) if the symbol exists in Gold, Silver and Crystal and a fixture shows it tracks the current map. Otherwise the reference-data generator builds a mapGroup/mapNumber to landmark table from pret per art version. The build ticket checks pret and picks one. Reading a table from ROM was rejected. `.describe()` says `section.id` is a landmark ID and not a map header ID.
  - **Gen 1:** the town-map location. The reference-data generator extracts pokered's per-map town-map entries (`data/maps/town_map_entries.asm`, names in `data/maps/names.asm`), and `section.id` is the town-map name index. Any map without an entry, which may include interiors, gives null. So does the whole generation if the build ticket finds the table isn't usable. Gen 1 town-map indices are their own id space, since Gen 1 stores no met location.
  - Landmark 0 and other special values give `{ id, name: null }`, as `met.location` does.
- Read `mapGroup`, `mapNumber`, `section`, `x` and `y` in one read pass so they agree. Gen 2 and Gen 3 fixtures must cover a map change, because the header or landmark byte may lag during a transition.

## 5. Bag

- **Pockets** use a closed `PocketId` enum, which joins the closed enums of §7.11.

  | Data format | Pockets, in game order | Capacity |
  |---|---|---|
  | Gen 1 | `items` (TMs and HMs included) | 20 |
  | Gen 2 | `items`, `keyItems`, `balls`, `tmhm` | 20, 25, 12, 57 |
  | Gen 3 and CFRU | `items`, `keyItems`, `balls`, `tmhm`, `berries` | from the profile: Emerald 30/30/16/64/46, FireRed 42/30/13/58/43, Ruby 20/20/16/64/46 |

  The response lists only the pockets the game has, in game order. An empty pocket is present with `items: []`. An open enum and a flat item list with a category field were rejected. Every format in scope has a fixed pocket set, and expansion hacks are out of scope.
- **`capacity`** is the most distinct entries the pocket can hold. For slot pockets that is the slot count. For the Gen 2 `tmhm` pocket it is 57 (50 TMs plus 7 HMs), so "n of capacity" means the same in every pocket.
- **`BagEntry`** is `{ item: Ref, quantity }`. `item.id` is the game's item ID, and names come from the item name table: reference data for official games, and for hacks the profile's `nameTables.items` table, one of the name tables spec §5.5 already requires (amendment 016 added `locations` beside it). A `slot` index with null empty slots was rejected.
  - Item ID 0 is the only empty-slot marker. Empty slots are skipped, and the remaining entries keep slot order.
  - In slot pockets (every pocket except the Gen 2 `tmhm` pocket), anything else is kept as stored, including quantity 0 and quantities above 99 or 999. `quantity` has no schema cap. An item ID the name table doesn't know gives `{ id, name: null }` and the entry stays.
  - Gen 2 key items store no quantity, so they get quantity 1. Gen 3 key items keep their stored quantity.
  - Gen 2 TM/HM counts are stored by TM index (1-50) and HM index (1-7). The decoder maps each index to the real item ID, so `tmhm` entries carry item IDs like every other pocket. This pocket is count storage, not slots, so a count of 0 means the TM is absent: a TM appears when its count is above 0, and an HM appears with quantity 1 when its flag is set. `.describe()` says so.
- **PC item storage** is not part of `bag` in v2.0. It goes to a v2.x map. If it's added, it becomes a separate top-level field, not a new `PocketId` value, so the closed enum still holds.

## 6. Profile and reference data

- The data format's profile block holds the per-game layout values: Gen 1-2 bag addresses, Gen 3 pocket offsets and capacities, Gen 3 badge flag IDs, the `gMapHeader` symbol, and the Gen 3 encryption key offset. Official values come from the generator reading pret. Hacks inherit them through `extends` and override what changed. Amendment 018 merges blocks one level deep, so a value nested below a block's top-level key is replaced whole. A hack that changes one pocket's capacity restates that whole top-level key, for example every pocket's offset and capacity if they sit under one `pockets` key. The build ticket's key layout decides how much a hack restates. Zod makes the keys required, so a capacity is never unknown. Exact key names are left to the build tickets. Constants in the decoder were rejected because a CFRU hack could then not change a capacity without a code change. This follows interfaces 004: decoders hold struct layouts and profiles hold addresses.
- **Encryption key.** The Gen 3 key offset in save block 2 is null for Ruby and Sapphire, which use no key. Money is XORed with the full 32-bit key, and coins and bag quantities with its low 16 bits. There's no plausibility check, since every 32-bit value, 0 included, is a valid key. Fixtures catch a wrong offset.
- **Gen 2 TM/HM item IDs.** The reference-data generator extracts the TM and HM item IDs from pret item constants into `gen2` reference data. A generator check fails if pokegold and pokecrystal disagree, and the key would then move to art version. Hard-coding them in the decoder was rejected.
- New reference data: badge names by art version (§3), Gen 1 town-map names and the map to town-map table, Gen 2 landmark names and, if needed, the map to landmark table (§4), and Gen 2 TM/HM item IDs.

## 7. Failures

A bad save-block pointer fails the decoders that use it that cycle, as amendment 013 decided, and the `player` and `bag` decoders each produce one whole resource. So a bad pointer or an undecodable read leaves that resource without a new value for the cycle. No field becomes null because a read failed. Corrupt values the schema bounds, such as minutes above 59, fail the same way. An unknown item ID or location ID is not a failure (§4, §5).

## 8. Viewer (§11.6)

- The badge row breaks into rows of eight when `badges.length > 8`, so Gen 2 shows Johto above Kanto. The viewer decides from the data, not from the generation.
- Badges render as filled or empty pips labelled with the badge name. When `name` is null, the label is "Badge N" with N = `id + 1`. Badge art would be a new icon source the spec doesn't list, so there is none in v2.0.
- Pockets render in the order and with the presence the response gives. Labels come from a static map keyed by `PocketId`, with a fallback label for an id the viewer doesn't know. Each pocket shows "n of capacity".

## Spec text this replaces

- §7.6: "The shapes of badges, map location and play time are not set. See §17 item 5." becomes §1-§4 here.
- §7.7: "The pocket list per generation and the entry shape are not set. See §17 item 5." becomes §5 here.
- §11.6: "Gen 2 has 16 badges, which an eight-badge row doesn't fit (§17 item 5)." becomes §8 here.
- §7.11: `PocketId` joins the closed enums.
- §17 item 5: resolved by this amendment.

## Left to build tickets

- Whether Gen 2 reads the landmark byte or a generated table, and whether pokered's town-map table is usable for Gen 1.
- Whether the Gen 3 save-block position includes the border offset, and that it stays live while walking.
- Profile key names for the §6 values.

Each unverified game fact has a gate in the build ticket for its data format (the rest of Gen 3, or Gen 1 and Gen 2):

| Fact | Gate | If it's wrong |
|---|---|---|
| Gen 1 BCD money, Gen 2 binary money, Gen 3 32-bit money | the player fixture's money check (spec §12.7 "player data: money") | fix the decoder; the shape doesn't change |
| Gen 3 pocket offsets and capacities, badge flag IDs, key offset | the generator reads them from pret constants and symbols; the bag and player fixtures check them | fix the generated profile values |
| Gen 3 XOR scope (full key for money, low 16 bits for quantities) | the bag and player fixtures for Emerald or FireRed | fix the decoder |
| Gen 2 TM/HM storage (50 counts, 7 HM entries) and capacities | the generator reads pret's pocket sizes and TM/HM constants; the bag fixture checks them | if HMs are stored as counts, an HM appears when its count is above 0, like a TM; capacity follows pret |
| Gen 3 `gMapHeader.regionMapSectionId` and FireRed's section range | the generator finds the symbol; a fixture compares `section.id` with a known map | fall back to a generated mapGroup/mapNumber to section table from pret, as Gen 2 may |
| Gen 2 `wCurLandmark` | §4: symbol in all three games plus a map-change fixture | the generated table (§4) |
| Gen 1 town-map entries | §4 | `section` is null in Gen 1 |

## Logged for a v2.x map

Game Corner coins, player gender, rival name, and PC item storage as a separate top-level field.

## Sources

Game facts (pocket capacities, money encodings, Gen 2 TM/HM storage, Gen 3 XOR key use, play-time caps, the Gen 3 `gMapHeader` field, pokecrystal's `wCurLandmark`, pokered's town-map files) come from game knowledge of the pret disassemblies and were not checked against pret in this ticket. The build tickets confirm each one against pret and fixtures. Each unverified fact has its gate and fallback in the table under "Left to build tickets".
