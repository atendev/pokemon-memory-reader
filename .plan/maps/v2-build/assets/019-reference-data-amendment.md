# Reference data source: amendment for spec §17 item 7

Resolves [Where does reference data come from?](../tickets/019-reference-data-source.md).

The owner settled each choice in a three-round grilling interview on 2026-11-13 and 2026-11-14. The facts come from [the Gen 3 checks](./019-reference-data-pret-gba.md), [the Gen 1-2 research](./019-reference-data-pret-gb.md) and [the hash research](./019-reference-data-hashes.md). Spec sections cite this amendment as "amendment 019 §N". This ticket doesn't edit the spec. Inside this amendment, "part N" means its own section N, and "§N" means a spec section.

## 1. Source and generator

- A dev-time generator reads the pret decompilations at pinned commits and writes reference data as committed JSON. It covers species, move, item, ability and location names, charmaps, species data (types for Gen 2 and Gen 3, gender ratio, ability slots, growth rate, National Dex number) and move data (type and base PP). Amendment 016 §5 added species types, move data and location names to the list.
- Each data format's tables hold only the fields that format has. Gen 1 has no gender ratio, abilities or held items, Gen 2 has no abilities, and Gen 1 decoders read species types from the mon struct. Amendment 016 §5 adds species types "for Gen 2 and Gen 3, since Gen 1 reads types from the struct". Those tables omit the fields, so Gen 1 species tables hold no types. Decoders return `null` for the missing fields, as the table in spec §6.3 already says.
- The generator writes only values, meaning strings, numbers and ID mappings in this project's own JSON shape. It copies no pret C or assembly text, comments or macro bodies into its output or its tests. Research notes may quote short pret excerpts of a few lines as evidence, as earlier research assets do. The profile generator takes addresses from pret symbols on the same reasoning, that these are facts and not source (§5.3, §14).
- Each generated file records its provenance: the pret repo, the commit SHA and the source file paths it read.
- The owner reviews generated output as a diff, as with generated profiles. The program never fetches pret data, and the build never runs the generator.
- Generator tests use hand-written inputs in pret's syntax, such as a made-up `[SPECIES_FOO] = _("FOO"),` line. They never check in excerpts of pret C or assembly files. The profile generator's checked-in `.sym` excerpts stay allowed, because a `.sym` file is a build output that lists addresses.
- The repos per data format are pokered and pokeyellow for Gen 1, pokegold and pokecrystal for Gen 2, and pokeruby, pokeemerald and pokefirered for Gen 3. A hack profile's `"vanilla"` entries use the Gen 3 tables, for the Gen 3 and CFRU data formats alike. The one exception is `nameTables.locations`, which uses the table for the hack's `artVersion` (part 4).

## 2. Name text

- Names are the text each game prints, decoded from pret's strings, such as `BULBASAUR`, `POKé BALL` and `THUNDERPUNCH`. The generator doesn't change their case or spelling.
- Official names then match hack names read from ROM (§5.5) and what v1 showed.
- A client that wants modern names maps them itself from `species.dex` or from move and item IDs.
- A generated reference table of names covers IDs 1 up to the last ID of its kind. Where a data format's repos differ in length, it runs to the end of the longest list, which for Gen 3 items is Emerald's list, whose last position is 376. The generator bounds the range by resolved numeric IDs, because part 4 notes that nobody confirmed Emerald's list position is its item ID. The generator writes every entry in that range as pret's table holds it, including filler names such as Gen 1's `MISSINGNO.` and `?????`. It skips ID 0, which no species, move, item or ability uses, such as `MOVE_NONE`. It also skips entries past the range that aren't of the table's kind, such as the floor names (`B4F`) after Gen 1's last item.
- Where a game builds a name at runtime instead of storing it, the generator applies the game's own rule, and the generator's build ticket cites the pret routine. Gen 1 TM and HM names are the known case, because Gen 1's item name table has none. How the game builds them was not checked.

## 3. Languages

- v2.0 ships English reference data only, and built-in official profiles cover English revisions only.
- English counts as supported once its smoke fixtures exist (§6.2, §12.6). Every primary revision is US English.
- The profile `language` field accepts only languages with shipped reference data, which is `"en"` in v2.0. The full-schema check (amendment 018 §3) fails a profile with any other value, and its error names the profile and the language. The viewer's profile list shows the error.
- A user with a ROM in another language may write a profile with `language: "en"` at their own risk. Names then come out in English, and strings decode with the English release's charmap.
- Reference data stays keyed by language, so a v2.x release can add a language without an API change.

## 4. Table keys

- Names, species data and move data are keyed by data format and language. One table serves every game of a data format.
- The generator enforces this. When it reads more than one repo for a data format, every ID the repos share must carry the same value in each, or the generator fails. A table that fails this check has to move to per-game keys in a later change.
  - Gen 3 names agree in the checks run so far. Species (412) and move (355) names match by constant name across pokeruby, pokeemerald and pokefirered, apart from the `MOVE_NONE` placeholder that part 2 skips. Ability names match line for line. Item names match at every shared list position, and pokeruby and pokefirered also match by numeric item ID, resolved from their `#define` lines. Emerald's 377 items extend FireRed/LeafGreen's 375 and Ruby/Sapphire's 349.
  - The species and move checks compared constant names. Emerald's items were compared by list position, because pokeemerald's item constants don't use plain `#define` lines, and nobody confirmed that Emerald's list position is its item ID. The generator compares resolved numeric IDs, so its check is the real test.
  - Gen 1 names match in pokered and pokeyellow.
  - Nobody has compared Gold/Silver with Crystal, or the Gen 3 species data and move data. The generator's check covers them.
- Location names are keyed by `artVersion` value instead of by data format: `ruby-sapphire`, `emerald`, `firered-leafgreen` or `crystal`. Ruby and Sapphire share a table, as do FireRed and LeafGreen. Gold and Silver store no met data (amendment 016). A hack whose `nameTables.locations` is `"vanilla"` gets its base game's table through the `artVersion` it already sets.
  - Locations need their own key because the games' tables differ. pokefirered's map-section list has no names for the Hoenn sections, Emerald lists 16 sections that FireRed lacks, and seven sections sit at different list positions in pokeemerald and pokefirered.
- A location ID that the table for its `artVersion` doesn't name, such as a Hoenn section in FireRed, gives a `null` name with its `id`, as other names do (§5.5).

## 5. Charmaps

- The same generator takes charmaps from pret, keyed by data format and language.
- The Gen 3 charmap holds two character sets. pret's `charmap.txt` maps 161 kana as well as the Latin set, at overlapping byte values.
- The Gen 3 decoder decodes the nickname and OT name of a mon whose `language` is Japanese (1) with the kana set, and every other mon's strings with the Latin set. The game picks the set by language the same way (inferred, not checked on hardware). The kana set ships as part of the English Gen 3 charmap.
- Amendment 016 already makes an egg's nickname null, so the egg placeholder stored under the Japanese language ID never reaches the output.

## 6. Growth curves

- The six experience curves are formulas in decoder code with integer math: Erratic, Fast, Medium Fast, Medium Slow, Slow and Fluctuating. The generator extracts nothing for them.
- Tests check known values, including each curve's level-100 total: 600,000, 800,000, 1,000,000, 1,059,860, 1,250,000 and 1,640,000 in that order.
- pret builds its own Gen 3 tables from six `EXP_*` formula macros, so the formulas give the games' values. §5.6's `exp: "vanilla"` uses these curves.
- v2.0 needs the curves only for Gen 3 and CFRU boxed mons (§5.6). Gen 1 and Gen 2 keep each mon's level in the party and box structs (not re-checked in this ticket), so their growth rates, including Gen 1's Slightly Fast and Slightly Slow, need no formulas in v2.0.

## 7. ROM hashes for `identify`

- `identify.sha1` comes from pret's per-revision SHA-1 files: `roms.sha1` in the Game Boy repos, `rom.sha1` in pokeemerald, and one `<build>.sha1` per build in pokeruby and pokefirered. The generator skips debug builds and `.patch` lines.
- `identify.crc32` comes from No-Intro's DAT data as mirrored in libretro-database at a pinned commit. The generator takes a CRC32 only from the No-Intro entry whose SHA-1 equals pret's SHA-1 for that revision. It matches by hash, never by entry name, because the DATs also hold unrelated entries named like the games.
- When pret and No-Intro disagree, or either one lacks the revision, the generator writes no hashes for that revision and reports it. German Sapphire 1.0 is the only disagreement today, and German isn't in v2.0.
- Hash provenance records the pret repo, commit and `.sha1` file, plus the libretro-database commit, DAT file and DAT version.
- A default-suite test fails when a built-in `kind: "official"` profile has an empty `sha1` or `crc32` list. The mGBA bridge always sends a CRC32, and under §5.4 a sent hash that matches nothing marks a clean ROM as modified. A built-in profile without its CRC32 would match on mGBA only through a manual pick.
- In-scope here means the 25 retail revisions pret builds, German included. No-Intro has CRC32 and SHA-1 for all 25, and 24 of its 25 SHA-1 values equal pret's.
- mGBA hashes the GBA ROM file as loaded. At mgba-emu/mgba `d58ea8a`, `src/gba/gba.c` line 475 computes `doCrc32(gba->memory.rom, gba->pristineRomSize)`, and line 432 takes `pristineRomSize` from the file size. No-Intro hashes the whole dump and lists every in-scope GBA dump at 16,777,216 bytes ([hash research](./019-reference-data-hashes.md), part 2 sizes), which avoids mGBA's special cases for 1 MiB files and files over 32 MiB. So the two CRC32 values agree for an unmodified ROM. The GB path at `src/gb/gb.c` line 229 hashes `romSize` bytes. No-Intro lists the in-scope Game Boy dumps at 1,048,576 bytes and the in-scope Game Boy Color dumps at 2,097,152, but nobody checked that mGBA's `romSize` equals the file size there.
- Whether revisions the owner doesn't own ship as built-in profiles stays with [What happens to signatures for revisions the owner doesn't own?](../tickets/022-unowned-revision-signatures.md). This amendment says only where their hashes come from.

## 8. Credits and licences

- `NOTICE` credits pret for reference data and SHA-1 values, and No-Intro, through libretro-database, for CRC32 values.
- The names stay Nintendo's text. The License decision already lets the repo and the executable bundle names and numeric reference data (§14).
- libretro-database is CC BY-SA 4.0. A hash value is a fact. Creative Commons also lists CC BY-SA 4.0 as one-way compatible with GPLv3, with attribution, which the `NOTICE` credit gives (not re-checked in this ticket).
- No-Intro's own DAT-o-MATIC terms were not read. Someone reads them before the release candidate.

## 9. Spec text this changes

- §5.1: `language` accepts only languages with shipped reference data (part 3).
- §5.3: the generator also writes reference data and hash lists, and its tests for C and assembly input use hand-written lines (parts 1 and 7).
- §5.4: `identify` lists come from part 7, and a test requires both lists on built-in official profiles.
- §5.5 and §5.6: `"vanilla"` resolves to the data format's tables, and `locations` to the table for the profile's `artVersion` (part 4).
- §6.2: the last bullet, which points to §17 item 7, gives way to this amendment. Keys follow §4, and v2.0 ships English only.
- §6.3: names are game text (part 2), and Gen 3 strings of Japanese-language mons use the kana set (part 5).
- §12.6: English is the only language in v2.0.
- §14: pret-derived data covers reference data and SHA-1 values, and `NOTICE` also credits No-Intro.
- §17 item 7: resolved by this amendment.
- Amendment 016 §5: the sources here cover the reference data it added.

## 10. How far each fact was checked

- Gen 3 names match across the three repos, apart from the `MOVE_NONE` placeholder. A script compared species and move names by constant name, Ruby/Sapphire and FireRed/LeafGreen item names by numeric ID resolved from each repo's item constants, and Emerald's items by list position.
- Gen 1 names match in pokered and pokeyellow. The research ran `diff` on the fetched files.
- The No-Intro coverage and the 24 matching SHA-1 values. The research read the DATs and pret's files at pinned commits.
- The Gen 3 charmap holds kana. A script counted the lines. How the file separates the two sets was not checked.
- mGBA's CRC32 covers the GBA file. Shown by the source lines in part 7 and the size table in the hash research, and not yet run against a real ROM.
- mGBA's GB `romSize` equals the file size. Not checked.
- Gen 1 and Gen 2 keep each mon's level in the party and box structs, which part 6 relies on. Not checked in this ticket. The Gen 1 and Gen 2 decoder tickets confirm it when they write the struct layouts.
- The game prints filler names such as `MISSINGNO.` for those IDs. Not checked.
- The game picks the kana set by language. Inferred.
- Map-section list position against numeric ID, the Gen 3 species data and move data formats, and all of Gen 2. Not checked. The generator's agreement check and its build ticket cover them.

## 11. Excluded

- Modern names from PokeAPI. They differ from the screen and from hack names, and the generator would still need pret for internal IDs and charmaps.
- Dumping tables from the owner's ROMs. The owner has no ROMs yet, and charmaps would still need another source.
- Reading official games' names from ROM at runtime. That reverses §5.5 and §5.6 and gives no names on adapters without ROM access.
- German or any other language in v2.0.
- Loading a profile in an unsupported language with null names, or with a silent English fallback.
- Growth tables extracted from pret.
- Hashes from the owner's ROMs only, which leaves unowned revisions without a CRC32, and hashes from No-Intro alone without the pret cross-check.
- A new `game` profile field to pick per-game tables. `artVersion` already tells the games apart for location names.
- Null nickname and OT name for Japanese-language mons.

## 12. Open items

- Read No-Intro's DAT-o-MATIC terms before the release candidate (part 8).
- How `charmap.txt` separates the Latin and kana sets at shared byte values. The generator's build ticket finds out.
- Whether map-section list position equals the numeric ID in pokeemerald and pokefirered. The location table must use the numeric IDs, so the generator's build ticket checks this.
- How control codes in pret strings, such as `{NAME_END}` in Ruby/Sapphire map names, become output text. The generator fails on any code it doesn't handle.
- How the generator resolves pokeemerald's numeric item IDs, since its `include/constants/items.h` has no plain `#define ITEM_X <number>` lines.
- The German Sapphire 1.0 SHA-1 disagreement, if German is ever added.
- For [How are ROMs keyed and re-identified?](../tickets/014-rom-keying-and-reidentification.md) and the unowned-signatures ticket: every English revision pret builds now has hashes without the owner owning it, but Gen 1-2 header values (title, global checksum) still come from the owner's ROMs (§5.3).

## 13. Before the build relies on it

- At the first live mGBA run ([First live run on mGBA](../tickets/011-first-live-run-mgba.md)), compare the bridge's `crc32` with the profile's list. The CRC32 choice rests on that fact for GBA. The first live run with a Game Boy ROM checks the GB path the same way.
- The generator's agreement check (part 4) catches a per-format table that differs between games.
