# Gen 1 and Gen 2 Pokémon schema facts from pret

Research for ticket 016, "What is the full Pokémon schema?". Checked on 2026-11-13. Facts only, no recommendations. Claims marked **inferred** are my reading of several routines or my arithmetic on the constants, not a line that states them.

## Sources

All three repos were read at the head of `master` on 2026-11-13, from the codeload tarball for that commit. A citation reads `repo path:line` and maps to `https://github.com/pret/<repo>/blob/<commit>/<path>#L<line>`.

| Short name | Repo | Commit |
|---|---|---|
| red | pret/pokered | a7b6c19e3b5c2d169abeacfe0e28047993872342 |
| yellow | pret/pokeyellow | b452f2ab07185075140061c5084ab866d5e4a794 |
| crystal | pret/pokecrystal | 3c813b0b4d82b39bf62185aceffb76fd6026c70b |

Searches covered the `constants`, `data`, `engine`, `home`, `macros` and `ram` directories of each repo. The `maps`, `scripts`, `audio` and `gfx` directories were not searched. No source code is copied here, only labels, constants, offsets and numbers.

## Summary

Pending until all six sections are written.

## 1. Types

### Gen 1 type IDs (red and yellow)

`constants/type_constants.asm` is identical in red and yellow (checked with diff). Lines 4 to 28 define these IDs, with the hex values in the file's comments:

- $00 NORMAL, $01 FIGHTING, $02 FLYING, $03 POISON, $04 GROUND, $05 ROCK, $06 BIRD, $07 BUG, $08 GHOST.
- $09 to $13 are unused. The file jumps over them with `const_next 20` and names the gap `UNUSED_TYPES` to `UNUSED_TYPES_END`.
- $14 FIRE, $15 WATER, $16 GRASS, $17 ELECTRIC, $18 PSYCHIC_TYPE, $19 ICE, $1A DRAGON.
- The file also marks `PHYSICAL` as the start of the first range (line 4) and `SPECIAL` as the start of the range at $14 (line 19).
- `NUM_TYPES` is the counter after DRAGON, so $1B (27). **Inferred** arithmetic, the file does not print the number.

`data/types/names.asm` (identical in red and yellow) has `BIRD` at table index 6 and the name string at line 40. The unused indices $09 to $13 all point at the NORMAL name (lines 14 to 16).

### Gen 2 type IDs (crystal)

`constants/type_constants.asm` lines 9 to 35 carry no numeric comments. Counting the `const` lines in order gives these values (**inferred** arithmetic):

- 0 NORMAL, 1 FIGHTING, 2 FLYING, 3 POISON, 4 GROUND, 5 ROCK, 6 BIRD, 7 BUG, 8 GHOST, 9 STEEL.
- 10 to 18 are unused. `const_next 19` then places `CURSE_TYPE` at 19 ($13).
- 20 FIRE ($14), 21 WATER, 22 GRASS, 23 ELECTRIC, 24 PSYCHIC_TYPE, 25 ICE, 26 DRAGON, 27 DARK ($1B).
- `TYPES_END` is 28. `NUM_TYPES` is defined as `TYPES_END + UNUSED_TYPES - UNUSED_TYPES_END - 1`, with the file's comment "discount BIRD" (line 37). That works out to 17.

`data/types/names.asm`: `CurseType: db "???@"` at line 37, placed at table index `UNUSED_TYPES_END - 1` (19) after Normal-name padding for the unused indices (lines 17 to 21). `Bird: db "BIRD@"` at line 46, table index 6.

### Which species and moves use BIRD and ???

- Gen 1 BIRD ($06). No species and no move uses it. In red and yellow the identifier appears only in the constant, the `TypeNames` table, and unrelated text (Pokédex category strings such as "TINY BIRD", the trainer class "BIRD KEEPER").
- Gen 2 BIRD (6). No species (no match in the 251 files of `crystal data/pokemon/base_stats`) and no move (`crystal data/moves/moves.asm`). The one engine reference is Hidden Power: `crystal engine/battle/hidden_power.asm` lines 82 to 85, under the comment "Skip Bird", steps over index 6 when it maps the DV-derived number to a type. The next step, "Skip unused types", jumps the gap from `UNUSED_TYPES` to `UNUSED_TYPES_END`.
- Gen 2 CURSE_TYPE (19, shown as "???"). Exactly one move uses it, CURSE, `crystal data/moves/moves.asm` line 190, with `EFFECT_CURSE`. No species uses it (no match in the 251 base-stats files). The engine skips it in Conversion (`crystal engine/battle/move_effects/conversion.asm` lines 47 and 76) and makes Conversion2 fail when the looked-up move type is CURSE_TYPE (`conversion2.asm` line 21).

## 2. Eggs in Gen 2

Gen 1 has no eggs. Everything below is from crystal.

### The EGG value

`crystal constants/pokemon_constants.asm` lines 274 to 276. `NUM_POKEMON` is 251 (CELEBI is $FB), then `const_skip ; fc` and `const EGG ; fd`. EGG is $FD.

### Party and box species lists

- Party. `wPartySpecies` is `ds PARTY_LENGTH` (6 bytes) right after `wPartyCount`, followed by one more byte `wPartyEnd` (`crystal ram/wram.asm` lines 3412 to 3416). An egg slot holds EGG there. `GiveEgg` writes it (`engine/pokemon/move_mon.asm` lines 1182 to 1188, the load of EGG is line 1187) and so does `DayCare_GiveEgg` (`engine/events/daycare.asm` line 459). The routines that treat eggs specially test this list entry, for example `ChangeHappiness`, `StepHappiness` and `GetFirstPokemonHappiness` (`engine/events/happiness_egg.asm`), and `DoEggStep` and `HatchEggs` (`engine/pokemon/breeding.asm` lines 174 to 236).
- Box. `sBoxSpecies` is `ds MONS_PER_BOX + 1` (20 mons plus a terminator, `macros/ram.asm` lines 102 to 105 and `constants/pokemon_data_constants.asm` line 138). `SendMonIntoBox` inserts `wCurPartySpecies` at the front of that list (`move_mon.asm` lines 942 to 965). `GetMonSpecies` (`engine/pokemon/tempmon.asm`, near lines 85 to 125) reads the species from `wPartySpecies`, `wOTPartySpecies` or `sBoxSpecies` into `wCurPartySpecies`, and callers compare it with EGG (`tempmon.asm` line 61, `engine/pokemon/bills_pc.asm` line 1072 and `BillsPC_IsMonAnEgg` at lines 1634 to 1637). **Inferred:** the box list therefore marks eggs with EGG as the party list does. I did not read the deposit routine itself.

### What the struct's species byte holds

`MON_SPECIES` is byte 0 of `box_struct` and `party_struct` (`crystal macros/ram.asm` lines 7 and 8). For an egg it holds the species that will hatch, not EGG.

- `GiveEgg` stores the real species (reduced to the first evolution stage by two `GetPreEvolution` calls, `move_mon.asm` lines 1121 to 1127) into `wPartyMon#Species` (lines 1178 to 1181) and writes EGG only into the list.
- `DayCare_GiveEgg` takes the species from `wEggMonSpecies` (`daycare.asm` lines 460 to 463).
- `HatchEggs` reads the egg's `wPartyMon#Species` to find the hatchling (`breeding.asm` lines 226 to 236).
- The four `ld a, EGG` loads in the searched tree are `move_mon.asm` 1187, `daycare.asm` 459, and `breeding.asm` 695 and 703. The last two feed the hatch animation graphics. **Inferred:** nothing writes EGG into the struct byte. A full audit of every `EGG` reference was not done.

### Nickname

The nickname is "EGG", stored as the text `"EGG@"` (terminator `@`).

- `String_Egg` at `move_mon.asm` lines 1219 and 1220, copied into the party nickname slot by `GiveEgg` (lines 1193 and 1194).
- `.String_EGG` at `daycare.asm` lines 723 and 724 for the daycare egg.

### Happiness byte and egg cycles

Yes. For an egg, the struct's happiness byte holds the remaining egg cycles ("step cycles to hatch").

- `MON_HAPPINESS` is at offset 27 in both structs (**inferred** by summing the field sizes in `crystal macros/ram.asm` lines 7 to 30: 1+1+4+2+3+10+2+4 = 27).
- `GiveEgg` fills it from `wBaseEggSteps`, the species' `BASE_EGG_STEPS` byte, or with 1 when the debug-field flag is set (`move_mon.asm` lines 1195 to 1207). Base stats files label that byte "step cycles to hatch" (`crystal data/pokemon/base_stats/pichu.asm` line 12, value 10).
- The daycare egg gets `wEggMonHappiness` from `wBaseEggSteps` (`daycare.asm` lines 706 to 713).
- `DoEggStep` decrements the byte for every party slot whose list entry is EGG and reports a hatch when one reaches 0 (`breeding.asm` lines 174 to 190). The overworld calls it with `farcall DoEggStep` (`engine/overworld/events.asm` line 898).
- `HatchEggs` handles slots that are EGG with the byte at 0, then writes $78 (120) into it (`breeding.asm` lines 206 to 228). After that it is an ordinary happiness value.
- The egg stats screen reads it as "egg status" (`wTempMonHappiness`, `engine/pokemon/stats_screen.asm` line 1030) to pick the hatch-time message.
- `StepHappiness` and `ChangeHappiness` skip EGG slots, so the normal happiness rules do not touch it (`happiness_egg.asm`).
- `GiveEgg` also sets the egg's current HP to 0 (`move_mon.asm` lines 1208 to 1216), and `CopyMonToTempMon` zeroes HP again for EGG (`tempmon.asm` lines 57 to 65). A zero HP on an egg is therefore not a faint.

<!-- pending: sections 3 to 6 -->
