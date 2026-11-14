# Reference data in the pret Game Boy disassemblies (WF-019, Gen 1-2)

Repos and commits read (all `master`, read 2026-11-13): pret/pokered `a7b6c19e3b5c2d169abeacfe0e28047993872342`, pret/pokeyellow `b452f2ab07185075140061c5084ab866d5e4a794`, pret/pokegold `f2cde36f49b994c143bfd18582182302fdc76492`, pret/pokecrystal `3c813b0b4d82b39bf62185aceffb76fd6026c70b`.

Status: partial. Gen 1 (pokered, pokeyellow) is filled in. The research run stopped at an API rate limit before the Gen 2 parts, which are marked as not researched.

Scope note: the project may not copy pret assembly. The idea is a dev-time script that reads these files, parses only the quoted strings and the numbers, and emits its own JSON with `{repo, commit, path}` provenance per value. Example lines below are evidence only, each at most 100 characters.

Link pattern: `https://github.com/pret/<repo>/blob/<sha>/<path>`.

## 1. Species, move and item names

### Gen 1 (pokered, pokeyellow)

All three name tables are byte-identical in pokered and pokeyellow (a `diff` of the fetched files showed 0 lines).

- Species: [data/pokemon/names.asm](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/data/pokemon/names.asm), also [pokeyellow](https://github.com/pret/pokeyellow/blob/b452f2ab07185075140061c5084ab866d5e4a794/data/pokemon/names.asm).
  - Example: `	dname "RHYDON"`.
  - 190 `dname` lines, closed by `assert_table_length NUM_POKEMON_INDEXES`. Unused slots are `dname "MISSINGNO."`.
  - Order is internal index order, not Pokedex order. The first line is index $01 = RHYDON (`const RHYDON             ; $01` in [constants/pokemon_constants.asm](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/constants/pokemon_constants.asm)). The table has no explicit index, so the index is the line position, counting from 1.
  - `dname` is defined in [macros/data.asm](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/macros/data.asm). It pads the name with `@` to `NAME_LENGTH - 1` (10) characters, so the stored bytes are `@`-padded. The source string has no padding.
  - Names are uppercase in-game text with a few glyphs from the charmap, such as `"NIDORAN♂"`. The source file is UTF-8.
- Moves: [data/moves/names.asm](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/data/moves/names.asm).
  - Example: `	li "POUND"`. 165 `li` lines, closed by `assert_list_length NUM_ATTACKS`.
  - Order is move ID order (POUND is move 1). The list starts with `list_start MOVE_NAME_LENGTH - 2`, and a comment says the in-battle "used <move>!" text fits 12 characters.
  - `li` is in [macros/asserts.asm](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/macros/asserts.asm). It emits `db "<string>", "@"`.
- Items: [data/items/names.asm](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/data/items/names.asm).
  - Example: `	li "MASTER BALL"`. 97 `li` lines, closed by `assert_list_length NUM_ITEMS + NUM_FLOORS`.
  - Order is item ID order starting at $01 (`const MASTER_BALL   ; $01` in [constants/item_constants.asm](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/constants/item_constants.asm)). The last entries are floor names (`li "B4F"`), which are not items.
  - Placeholder items have the name `"?????"` with the constant in a trailing comment: `	li "?????" ; SURFBOARD` (ID $07) and `ITEM_2C`. A parser must keep the comment out of the string.
  - TM and HM items are not in this table. [constants/item_constants.asm](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/constants/item_constants.asm) lists them as `add_hm CUT          ; $C4` (HM01 to HM05) and `add_tm MEGA_PUNCH   ; $C9` (TM01 onward, 50 TMs). The display names HM01 and TM01 are most likely built at runtime (unverified).

### Gen 2 (pokegold, pokecrystal)

_Not researched. The run stopped at an API rate limit._

## 2. Charmap

### Gen 1

- File: [constants/charmap.asm](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/constants/charmap.asm), 386 lines, 333 `charmap` lines.
- Example: `	charmap "<NULL>",    $00`. Control codes are named in angle brackets, for example `charmap "<PKMN>",    $4a ; "<PK><MN>"`.
- pokered and pokeyellow: identical (`diff` showed 0 lines).

### Gen 2

_Not researched. The run stopped at an API rate limit._

## 3. Species data

### Gen 1 internal index to National Dex

- Internal index constants: `const_def` then `const <NAME> ; $NN` in [constants/pokemon_constants.asm](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/constants/pokemon_constants.asm). Index $00 is `NO_MON`. 36 lines are fillers (`MISSINGNO` or `const_skip`).
- Mapping table: [data/pokemon/dex_order.asm](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/data/pokemon/dex_order.asm). Label `PokedexOrder`, 190 lines (one per internal index), identical in pokeyellow.
  - Example: `	db DEX_RHYDON`. The line position is the internal index. The value is the `DEX_*` constant.
  - Dex constants: [constants/pokedex_constants.asm](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/constants/pokedex_constants.asm) starts `const_def 1`, then `	const DEX_BULBASAUR  ; 1`. So the dex number is the position in that list, and the trailing comment repeats it.
  - Filler slots map to `db 0` (unverified; not read).
- The BaseStats table is in Pokedex order, not internal order ([data/pokemon/base_stats.asm](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/data/pokemon/base_stats.asm) is a list of `INCLUDE "data/pokemon/base_stats/bulbasaur.asm"` lines starting at Bulbasaur).
- Mew: pokered excludes it from the table (`assert_table_length NUM_POKEMON - 1 ; discount Mew`). pokeyellow includes `INCLUDE "data/pokemon/base_stats/mew.asm"`. Both repos have a `base_stats/mew.asm` file.

### Gen 1 per-species fields

Each species has one file, [data/pokemon/base_stats/bulbasaur.asm](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/data/pokemon/base_stats/bulbasaur.asm). Lines of interest:

- `	db DEX_BULBASAUR ; pokedex id` is the first line. It gives the National Dex number through the `DEX_*` constant.
- `	db GRASS, POISON ; type`. Type constants need [constants/type_constants.asm](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/constants/type_constants.asm). Gen 1 type values have gaps (`const BIRD ; $06`, then `const_next 20`, then `const FIRE ; $14`).
- `	db GROWTH_MEDIUM_SLOW ; growth rate`. Constants are in [constants/pokemon_data_constants.asm](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/constants/pokemon_data_constants.asm): MEDIUM_FAST, SLIGHTLY_FAST, SLIGHTLY_SLOW, MEDIUM_SLOW, FAST, SLOW, in that order (so 0 to 5).
- No gender ratio in Gen 1 (none of these fields exist in the file).

pokeyellow vs pokered: 23 species files differ ([base_stats list](https://github.com/pret/pokeyellow/tree/b452f2ab07185075140061c5084ab866d5e4a794/data/pokemon/base_stats)): alakazam, butterfree, chansey, charizard, cubone, diglett, dragonair, dragonite, dugtrio, eevee, flareon, gyarados, jolteon, kabutops, kadabra, marowak, mew, mewtwo, primeape, tangela, vaporeon, venomoth, venonat. A script check on all 23 found no difference in the `pokedex id`, `type` or `growth rate` lines. The two diffs read in full (eevee, charizard) change only the level-1 learnset and the TM/HM line (for example `TAIL_WHIP` replaces `SAND_ATTACK`). Whether the stat numbers differ in the other 21 was not checked.

## 4. Move data per move

### Gen 1

- File: [data/moves/moves.asm](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/data/moves/moves.asm), identical in pokeyellow (`diff` 0 lines).
- Example: `	move POUND,        NO_ADDITIONAL_EFFECT,        40, NORMAL,       100, 35`.
- Macro `move` (top of the same file) takes: animation (same value as the move ID), effect, power, type, accuracy in percent, PP. Type is a constant name; resolve it with `constants/type_constants.asm` as above. PP is a plain number (the macro asserts it is 40 or less).
- Row order is move ID order. There is no name in the row; names come from `data/moves/names.asm` (same order).

### Gen 2

_Not researched. The run stopped at an API rate limit._

## 5. Crystal landmark names

_Not researched. The run stopped at an API rate limit._

## 6. Per-revision SHA-1 files

### Gen 1

- File: [roms.sha1](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/roms.sha1) at the repo root. Line format is `<40 hex SHA-1> *<file name>`.
- Example: `ea9bcae617fdf159b045185467ae58b2e4a48b9a *pokered.gbc`.
- pokered covers 5 files: `pokered.gbc`, `pokeblue.gbc`, `pokeblue_debug.gbc`, `pokered.patch`, `pokeblue.patch`.
- pokeyellow covers 3 files: `pokeyellow.gbc`, `pokeyellow_debug.gbc`, `pokeyellow.patch` ([roms.sha1](https://github.com/pret/pokeyellow/blob/b452f2ab07185075140061c5084ab866d5e4a794/roms.sha1)).
- What the `.patch` entries are (apparently Virtual Console patch outputs) was not confirmed (unverified).

### Gen 2

_Not researched. The run stopped at an API rate limit._

## 7. Item list differences for the same ID

### Red/Blue vs Yellow

- [data/items/names.asm](https://github.com/pret/pokeyellow/blob/b452f2ab07185075140061c5084ab866d5e4a794/data/items/names.asm) is identical (`diff` 0 lines). The ID order in `constants/item_constants.asm` is identical up to the end of the list. Yellow only appends two constants at the end: `DEF TWISTEDSPOON_GSC EQU $60` and `DEF LIGHT_BALL_GSC   EQU $a3` (Time Capsule compatibility).
- So the same ID has the same name in Red, Blue and Yellow.

### Gold/Silver vs Crystal

_Not researched. The run stopped at an API rate limit._

## 8. Growth rates

### Gen 1

- Table: label `GrowthRateTable` in [data/growth_rates.asm](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/data/growth_rates.asm) (identical in pokeyellow). It holds 6 rows of formula coefficients, not experience values per level.
- Row example: `	growth_rate 6, 5, -15, 100, 140 ; Medium Slow`. The comment above the macro reads `[1]/[2]*n**3 + [3]*n**2 + [4]*n - [5]`.
- Routines that evaluate it at runtime: `CalcExperience` and `CalcLevelFromExperience` in [engine/pokemon/experience.asm](https://github.com/pret/pokered/blob/a7b6c19e3b5c2d169abeacfe0e28047993872342/engine/pokemon/experience.asm).
- So Gen 1 computes experience by a cubic formula at runtime, with the coefficients held in a table.

### Gen 2

_Not researched. The run stopped at an API rate limit._

## Open gaps

- Every Gen 2 part: names, charmap, species data, move data, Crystal landmarks, SHA-1 files, Gold/Silver against Crystal, and growth rates.
- Gen 1 parts 3, 4, 6 and 8 hold what the run wrote before it stopped. Treat anything missing there as not researched.
