# Pokémon schema amendment

This amendment resolves spec §17 item 4 for the ticket [What is the full Pokémon schema?](../tickets/016-pokemon-schema.md). Spec sections cite it as "amendment 016 §N". It settles the open points in §6.3, §7.5 and §7.8, and it adds to §5.5, §5.6, §6.2, §6.5, §7.11 and §11.9.

The owner decided it in a five-round grilling on 2026-11-13. Some facts come from [the CFRU research](./016-pokemon-schema-cfru.md) and [the Gen 1-2 research](./016-pokemon-schema-gen12.md), which cite the pret, CFRU and DPE sources. The rest is game knowledge that no source check has confirmed yet. §7 lists every inferred fact and names the game-knowledge ones. Any §2 to §4 game fact that neither research file covers counts as game knowledge. The decoder tickets confirm both kinds against pret or CFRU before relying on them.

## 1. The schema

One `Pokemon` shape serves `party`, box slots and `opponent.party`. `Battler.moves` uses the same `Move`.

```ts
type Ref = { id: number; name: string | null };
type Stats = { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };

type Type =
  | "normal" | "fighting" | "flying" | "poison" | "ground" | "rock"
  | "bug" | "ghost" | "steel" | "mystery" | "fire" | "water"
  | "grass" | "electric" | "psychic" | "ice" | "dragon" | "dark"
  | "fairy";

type Nature =
  | "hardy" | "lonely" | "brave" | "adamant" | "naughty"
  | "bold" | "docile" | "relaxed" | "impish" | "lax"
  | "timid" | "hasty" | "serious" | "jolly" | "naive"
  | "modest" | "mild" | "quiet" | "bashful" | "rash"
  | "calm" | "gentle" | "sassy" | "careful" | "quirky";

type Status = "none" | "sleep" | "poison" | "toxic" | "burn" | "freeze" | "paralysis";

type Move = {
  id: number;
  name: string | null;
  type: Type | null;
  pp: number;
  maxPp: number | null;
  ppUps: number;
};

type Pokemon = {
  species: { id: number; dex: number | null; name: string | null };
  nickname: string | null;
  ot: { name: string; id: number; secretId: number | null; gender: "male" | "female" | null } | null;
  isEgg: boolean;
  eggCycles: number | null;
  level: number | null;
  experience: number | null;
  friendship: number | null;
  types: Type[] | null;
  hp: number | null;
  maxHp: number | null;
  stats: Stats | null;
  ivs: Stats;
  evs: Stats | null;
  status: Status | null;
  ability: Ref | null;
  heldItem: Ref | null;
  nature: Nature | null;
  ball: Ref | null;
  pokerus: "none" | "infected" | "cured" | null;
  moves: Move[];
  met: {
    location: Ref | null;
    level: number | null;
    game: "sapphire" | "ruby" | "emerald" | "firered" | "leafgreen" | "gamecube" | null;
    timeOfDay: "morning" | "day" | "night" | null;
  } | null;
  personality: number | null;
  language: number | null;
  shiny: boolean;
  gender: "male" | "female" | "genderless" | null;
  hiddenPower: { type: Type; power: number } | null;
};
```

Key stability (§7.5) holds. Every key is present, and `null` means the generation, the struct or a data source lacks the value. Fields this amendment doesn't mention keep their §7.5 and §6.3 rules.

## 2. Field rules

- **`shiny`.** A plain boolean in every generation. Gen 1 uses the Gen 2 DV rule (Defense, Speed and Special DVs of 10, and an Attack DV of 2, 3, 6, 7, 10, 11, 14 or 15). That is the shininess the mon shows once traded to Gen 2, and v1 did the same. `.describe()` says so. The viewer still requests no Gen 1 shiny sprite (§11.9), so a shiny Gen 1 mon gets the shiny marker with the normal sprite. This replaces the "Contradictory" cell in §6.3.
- **`isEgg`.** False in Gen 1. Gen 2 reads the slot's byte in the party or box species list, where EGG is 0xFD (inferred for box lists, §7), because the struct's species byte holds the species that will hatch. A Gen 2 egg's `species.id` comes from that struct byte, never from the list. Gen 3 and CFRU read the egg bit of the misc substructure (bit 30 of the IV word). An egg's other fields report what is stored, and clients hide what the game hides. A Gen 2 egg has 0 HP, which is not a faint.
- **`eggCycles`.** An egg's remaining hatch counter, which Gen 2 and Gen 3 keep in the friendship byte. It is null for hatched mons and in Gen 1. For an egg, `friendship` and `nickname` are null. Gen 2 stores the nickname "EGG", and Gen 3 stores a Japanese placeholder under the Japanese language ID.
- **`friendship`.** 0-255. It is null in Gen 1, for eggs, and wherever the struct a mon is built from lacks it. Yellow keeps its starter Pikachu's friendship outside the mon struct, and that stays null too.
- **`experience`.** Total experience as stored. It is null for mons built from a Gen 1-2 battle struct, which stores none (Gen 1-2 wild opponents).
- **`types`.** One or two entries, with a repeated type collapsed, since a mono-type species stores its type twice. They come from the struct where the generation stores them: Gen 1 party and box structs, and the Gen 1-2 battle structs that wild opponents are built from. Otherwise they come from species data, which is reference data for official profiles and the `speciesData.info` entry for hack profiles (§4). `Battler.types` always reads the battle struct or battle mon, and §3 covers CFRU. `types` is null when species data is unavailable or a stored ID isn't in the data format's type table (§3).
- **`status`.** `none` means no condition. Gen 3 and CFRU read Toxic from the status bit. Gen 1-2 keep bad poison in a battle-only volatile flag, so Gen 1-2 battlers read that flag to report `toxic`, and Gen 1-2 party mons report plain `poison`. The sleep counter is not exposed. Fainting stays derived from `hp`. `status` is null where the struct stores none, as for Gen 2-3 box mons (§7.9).
- **`nature`.** The 25 names in Gen 3 ID order, so `personality % 25` indexes the union as written. CFRU always derives nature this way and stores no override, so the CFRU decoder uses `personality % 25`. Whether Radical Red stores an override such as mints is unconfirmed (§7), and the hack-profile work checks it before a Radical Red profile ships. `nature` is null in Gen 1-2.
- **`ball`.** An item reference whose `id` is the game's item ID, so names come from the item name table and icons from `item/{itemId}`. Gen 3 stores the ball's item ID (1-12) in four bits of the origins word. CFRU stores a ball ID (0-27) in a full byte at +0x0A of the growth substructure, not the four-bit field v1 read. The research infers that the CFRU decoder maps a ball ID to an item by scanning the `type` byte of the ROM item table, since CFRU ships no ball-to-item table (§7). `ball` is null in Gen 1-2, and when a CFRU ball ID maps to no item or the item table is unavailable.
- **`pokerus`.** From the Pokérus byte, with the strain in the high nibble and days left in the low nibble. It is `none` when the byte is 0, `infected` while days are above 0, and `cured` when only the strain is set. It is null in Gen 1 and for mons built from a Gen 1-2 battle struct.
- **`moves`.** The filled slots in slot order, zero to four entries. `type` and `maxPp` come from move data (§4 for hack profiles, §5 for official profiles). `type` is the move-data type, so Hidden Power stays `normal` and `hiddenPower.type` holds the computed type. `ppUps` is 0-3 in every generation, read from the top two bits of each PP byte in Gen 1-2 and from the PP bonus byte in Gen 3. Each PP Up adds a fifth of base PP, rounded down. Gen 1-2 cap that bonus at 7, so a 40-PP move tops out at 61.
- **`met`.** One object, null where nothing is stored: Gen 1, Gold and Silver, and mons built from a Gen 1-2 battle struct.
  - Gen 3 and CFRU fill `location` from the met-location byte, a map-section ID, and `level` from the met level as stored, where 0 means hatched. `game` comes from the origin-game bits: 1 is `sapphire`, 2 `ruby`, 3 `emerald`, 4 `firered`, 5 `leafgreen` and 15 `gamecube`, and any other value gives null. `timeOfDay` is null.
  - Crystal fills `location` from the caught-location landmark ID, `level` from the caught level, and `timeOfDay` from the caught-time bits. `game` is null.
  - Special location values that aren't map sections, such as egg gifts, in-game trades and fateful encounters (0xFD-0xFF in pokeemerald), give `{ id, name: null }`. `.describe()` lists them.
  - Location names come from reference data or a hack's `locations` name table (§4).
- **`personality`.** The Gen 3 personality value as an unsigned 32-bit number. It is null in Gen 1-2.
- **`language`.** The Gen 3 language ID as stored (1 Japanese, 2 English, 3 French, 4 Italian, 5 German, 6 Korean, 7 Spanish). It is null in Gen 1-2. A Gen 3 egg reports the Japanese ID until it hatches.
- **`ot`.** Null where no OT buffer exists (§7.5). `id` is the visible 16-bit trainer ID. `secretId` is the upper 16 bits of the Gen 3 OT ID, and null in Gen 1-2. `gender` comes from the OT gender bit in Gen 3 and Crystal, and is null otherwise.
- **Left for v2.x.** Markings, contest stats and ribbons, which the owner didn't pick, and any other struct field this amendment doesn't list, since the map sends features the spec lacks to a v2.x map. Adding them later doesn't break clients, because published schemas are loose objects (§7.11).

## 3. Enums and type IDs

`Type`, `Nature`, `Status`, `pokerus`, `met.game`, `met.timeOfDay`, `ot.gender`, `status.game.moveData` and `status.game.names.locations` join the closed enums of §7.11, and the server test that fails when a closed enum changes covers them. A stored value outside an enum gives null for that field, or for the whole `types` list, never an extra value.

Each data format maps its type IDs in code. The research files list the full tables.

- **Gen 1.** Fifteen types: normal to rock at 0x00-0x05, bug and ghost at 0x07-0x08, and fire to dragon at 0x14-0x1A. BIRD (0x06) has no species or move and gives null.
- **Gen 2.** Gen 1's IDs plus steel (0x09), dark (0x1B) and CURSE_TYPE (0x13), which maps to `mystery`. Only the move Curse has it. The research counted these values from `const` lines, because those lines carry no numeric values and the skips use `const_next` (§7).
- **Gen 3.** 0x00-0x11 in pret order, with MYSTERY (0x09) mapping to `mystery`.
- **CFRU.** Gen 3's IDs plus FAIRY (0x17), which maps to `fairy`. In battle, CFRU treats MYSTERY (0x09), ROOSTLESS (0x13) and BLANK (0x14) as blank. `Battler.types` drops them and appends a real `type3`, so a CFRU battler shows zero to three types. A typeless battler shows `[]`, and a battler using Roost shows no Flying until the end of the turn.

`hiddenPower.type` never yields `mystery` or `fairy`.

## 4. Hack profiles

**Species types.** They come from the `speciesData.info` entry at +0x06 (type 1) and +0x07 (type 2), in the table hack profiles already declare (§5.6). When `info` fails, `types` is null too. `info` validation adds a check that every non-empty entry's type IDs are in the data format's type table.

**Move data.** Every `kind: "hack"` profile has a required `moveData`, either a table `{ base, count }` or `"vanilla"`, which uses reference data and reports `"builtin"`. Zod rejects an omission. `base` uses the address form of §5.1.

- Entries are 12 bytes in Gen 3 and CFRU, with the type at +0x02 and base PP at +0x04. CFRU puts z-move power, split and z-move effect in the three bytes vanilla leaves as padding. The research infers the 12-byte stride and the vanilla layout without reading the vanilla struct (§7).
- CFRU's `repointall` repoints the header word at 0x080001CC. As with species data, a profile uses `{ "ptr": "0x080001CC" }` only when the owner confirms the repoint, and otherwise takes `base` from `scripts/find-rom-tables`.
- The program loads it with the name tables, in chunks of at most 64 KiB, before `status.state` becomes `game`. A failing table doesn't hold the state back.
- The program validates the table whole, then discards and logs it on failure. `base` must resolve into cartridge space, and the table must end at or below 0x09FFFFFF. The share of non-empty entries (base PP above 0, entry 0 excluded) must meet the 90% constant. Every non-empty entry needs a type in the data format's type table. The owner rechecks the thresholds against a real hack ROM, as for §5.6.
- If the table fails, every move's `type` and `maxPp` are null, and `id`, `name`, `pp` and `ppUps` still decode. Nothing falls back to official data. A move ID beyond `count` gives null for that move only.
- `status.game.moveData` is `"builtin" | "rom" | "unavailable"` (closed). Official profiles report `"builtin"`.
- `scripts/find-rom-tables` finds the move table by Pound's entry and prints a `moveData` fragment.

**Location names.** `nameTables` gains a fifth required key for `kind: "hack"` profiles, `locations`, which is a table or `"vanilla"`. Zod rejects an omission.

- A `locations` table may use a new name kind, `{ kind: "pointer", maxLength }`. The entry holds a 4-byte pointer at `nameOffset` to a 0xFF-terminated string. FireRed-based hacks use a stride of 4. Emerald-based hacks use 8-byte entries with the pointer at +4.
- Only `locations` may use `pointer`. Species, moves, items and abilities stay inline-only, as §5.5 decided.
- Validation adds per-entry checks. The pointer must resolve into cartridge space, and the string must end within `maxLength` and use only Gen 3 charmap bytes. The 90% non-empty share and the whole-table discard apply as in §5.5.
- The program reads the strings in a second phase, like pointer-derived regions (§6.1, §8.5), in chunks of at most 64 KiB.
- `status.game.names` gains `locations`, which is null where the game stores no met data (Gen 1, Gold and Silver).
- `scripts/find-rom-tables` finds the table through the pointers to its first map name and prints a `locations` fragment.

## 5. Reference data additions

Official profiles need three more kinds of reference data, keyed by generation and language as §6.2 sets:

- species types for Gen 2 and Gen 3, since Gen 1 reads types from the struct
- move type and base PP for Gen 1-3
- location names: Crystal's landmarks and the Gen 3 map sections

Where they come from stays with [Where does reference data come from?](../tickets/019-reference-data-source.md).

## 6. Spec text this changes

The spec edit that applies this amendment touches these sections:

- §5.1: the profile keys `moveData` and `nameTables.locations`.
- §5.5: the `locations` key, the `pointer` kind for it, and `status.game.names.locations`.
- §5.6: types at +0x06 and +0x07, the type-ID check in `info` validation, and `moveData` beside `speciesData`.
- §6.2: the reference data in §5 above.
- §6.3: the Gen 1 `shiny` cell, and rows for the new fields or a pointer to §2 above.
- §6.5: Gen 2 decoders read each slot's species-list byte, only to set `isEgg`. They still decode slots by position and still ignore the count byte and the terminator.
- §7.5: the schema in §1 replaces the open list.
- §7.8: `Battler.types` shows zero to three types in CFRU with blank IDs dropped. Battler moves use `Move`, and Gen 1-2 battlers report `toxic`. The sentence saying hack profiles declare no types table goes.
- §7.11: the closed enums in §3 above.
- §11.3: the party card's ball icon comes from `ball.id`, and a shiny Gen 1 mon gets the shiny marker with the normal sprite.
- §11.9: `typeName` takes the `Type` values. The owner picked `mystery` because it is URL- and filename-safe, so the icon route needs no URL-encoding and icon-pack paths can use `mystery` where §11.9 wrote `unknown`. §11.9 already maps ??? to PokeAPI type 10001.
- §17 item 4: resolved by this amendment.

## 7. Facts still to confirm

- The Gen 1-2 research stopped after its second fact when the API rate limit hit. These rules come from game knowledge, and the Gen 1-2 decoder and battle tickets confirm them against pret:
  - the Gen 2 Pokérus byte
  - what the Gen 1-2 battle structs store (friendship, Pokérus, experience, PP Ups)
  - the Gen 1-2 PP Up cap
  - the badly-poisoned volatile flags
  - Yellow's Pikachu friendship
  - Crystal's caught-time values
- These facts are game knowledge that neither research file covers:
  - the Gen 1-2 PP-byte layout behind `ppUps`
  - the type bytes in Gen 1 party and box structs and in Gen 1-2 battle structs
  - the Gen 3 egg bit (bit 30 of the IV word), the Gen 3 egg nickname and language, and the Gen 3 Pokérus nibbles
  - the Gen 3 origin-game codes and language IDs
  - Crystal's OT gender bit
  - where CFRU keeps the met-location byte and the origin-game bits
  - the Gen 2 shiny DV set that Gen 1 borrows
  - the Gen 3 Toxic status bit and the nature order behind `personality % 25`
  - the PP Up bonus of a fifth of base PP
  - that Gold and Silver store no met data, that Gen 3 met level 0 means hatched, and Crystal's caught-location and caught-level fields
  - the Gen 3 egg cycles in the friendship byte, the Gen 3 ball bits in the origins word, the Gen 3 met-location byte, and the Gen 3 secret ID and OT gender bit
  - that Gen 1 stores no friendship and no met or caught data, and that Gen 2-3 box mons store no status (spec §7.9)
- The research infers these, and §2 to §4 mark them:
  - the Gen 2 box list's EGG marking, and that nothing writes EGG into the struct's species byte
  - the Gen 2 type IDs, counted from `const` lines
  - CFRU's ball byte position, which rests on the substructure order and decryption, and its ball-to-item mapping, since the item table is in neither repo
  - the 12-byte move-data stride and the vanilla padding layout
- The Gen 3 special met-location values and the FireRed and Emerald location-name table layouts come from game knowledge. The Gen 3 decoder and the hack-profile work confirm them.
- Radical Red may store a nature override, such as mints. Neither the CFRU nor the DPE source answers this, and nothing has checked Radical Red itself.
- The 0x1C species-info stride is still inferred (§17 item 11).
