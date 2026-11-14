# 019: ROM hashes (CRC32 and SHA-1) for every in-scope revision, without owning the ROMs

Sources read on 2026-11-13, except the size table in part 2, read on 2026-11-14: pret/pokered a7b6c19e3b5c2d169abeacfe0e28047993872342, pret/pokeyellow b452f2ab07185075140061c5084ab866d5e4a794, pret/pokegold f2cde36f49b994c143bfd18582182302fdc76492, pret/pokecrystal 3c813b0b4d82b39bf62185aceffb76fd6026c70b, pret/pokeruby 5784633ce4ef7ade1a7f2d2d0c288e3d5e6cdd7f, pret/pokefirered ce6406d8c2eaf46d543c8a2606de0c3cb1951982, pret/pokeemerald 731ad5bfd6e6f265508d0efcca0ba42f9dcf5881, libretro/libretro-database 5e01cef0d4d264e05f8021d89e6b4a193fd50aa7 (`metadat/no-intro/`, DAT header version 2026.10.07). Every file was read at the pinned commit through `gh api repos/<owner>/<repo>/contents/<path>?ref=<sha>`. No ROM was downloaded or hashed.

Status: final. Part 4 was not researched, because the run stopped at an API rate limit. The main thread filled in part 5 on 2026-11-14.

## Answer in brief

- Yes. The No-Intro DATs in libretro-database hold CRC32, SHA-1, MD5 and size for all 25 in-scope revisions. That covers both hashes the bridges need.
- pret ships SHA-1 only. No pret repo has a CRC32 anywhere. CRC32 therefore has to come from No-Intro.
- 24 of the 25 pret SHA-1 values equal the No-Intro SHA-1 exactly. One does not: Sapphire German 1.0 (see part 3).
- The libretro-database repo is licensed CC-BY-SA-4.0. That licence covers the repo. It is silent on No-Intro's own terms for the upstream data (see part 4).
- Last change to the three DAT files: 2026-10-08, commit 9a899f5b13ed1c355491e342203be29bc573323b, "Update Redump, TOSEC, and No-Intro (#1738)".

## 1. pret SHA-1 files

Every pret repo ships SHA-1 only. Line format is the `sha1sum` format: 40 hex digits, one or two spaces, an optional `*` binary marker, then the file name `make` produces. `make compare` checks the built ROM against these lines (read in pokeruby's Makefile: `$(SHA1SUM) $(BUILD_NAME).sha1`). Hex is lowercase.

| Repo | File(s) at repo root | Revisions covered |
|---|---|---|
| pokered | `roms.sha1` (5 lines) | Red, Blue (English), a Blue debug ROM, two `.patch` lines |
| pokeyellow | `roms.sha1` (3 lines) | Yellow (English), a Yellow debug ROM, one `.patch` line |
| pokegold | `roms.sha1` (6 lines) | Gold, Silver (English), their debug ROMs, two `.patch` lines |
| pokecrystal | `roms.sha1` (6 lines) | Crystal 1.0 (`pokecrystal.gbc`), Crystal 1.1 (`pokecrystal11.gbc`), Crystal Australian (`pokecrystal_au.gbc`), two debug ROMs, one `.patch` line |
| pokeruby | one file per build: `ruby.sha1`, `ruby_rev1.sha1`, `ruby_rev2.sha1`, `ruby_de.sha1`, `ruby_de_rev1.sha1`, the same five for `sapphire`, plus four `*_debug.sha1` | Ruby and Sapphire 1.0, 1.1, 1.2, German 1.0, German 1.1, plus debug builds |
| pokefirered | one file per build: `firered.sha1`, `firered_rev1.sha1`, `firered_switch.sha1`, `leafgreen.sha1`, `leafgreen_rev1.sha1`, `leafgreen_switch.sha1` | FireRed and LeafGreen 1.0, 1.1 and the Switch build |
| pokeemerald | `rom.sha1` (1 line) | Emerald (English) only |

The `.patch` lines and the `*_debug` lines are not retail ROMs. Ignore them for `identify`.

The Switch build is a separate dump. pret names it `firered_switch` and `leafgreen_switch`. No-Intro names it "(Rev 10) (Switch)" and gives it its own CRC32 and SHA-1, different from 1.0 and 1.1. So the "rev10" in pret's wording is No-Intro's "Rev 10".

## 2. No-Intro data in libretro-database

- The data is in `metadat/no-intro/`. Pokémon entries are spread over three files: `Nintendo - Game Boy.dat` (Red, Blue, Yellow), `Nintendo - Game Boy Color.dat` (Gold, Silver, Crystal), `Nintendo - Game Boy Advance.dat` (Ruby, Sapphire, Emerald, FireRed, LeafGreen). Yellow sits in the Game Boy file because it is a Game Boy game with CGB enhancement.
- Format is clrmamepro text. Each game is a `game ( name "..." region "..." rom ( name "..." size N crc XXXXXXXX md5 ... sha1 ... ) )` block. Hex is uppercase in the DAT. The table below is lowercase.
- Names use "Pokemon" with no accent.
- DAT headers: `version "2026.10.07"`, `homepage "http://github.com/robloach/libretro-dats"`.
- Last commit touching all three files: 9a899f5b13ed1c355491e342203be29bc573323b, 2026-10-08T20:53:24Z, "Update Redump, TOSEC, and No-Intro (#1738)". Repo HEAD when read: 5e01cef0d4d264e05f8021d89e6b4a193fd50aa7, 2026-11-11T23:54:46Z.
- The repo README says the No-Intro folder is a "Bulk import from upstream No-Intro databases" and credits http://datomatic.no-intro.org as the source for all three systems.
- Licence: `LICENSE` at the repo root, GitHub reports CC-BY-SA-4.0. First line of the file: "Attribution-ShareAlike 4.0 International", then the standard Creative Commons legal-text preamble ("Creative Commons Corporation ("Creative Commons") is not a law firm and does not provide legal services or legal advice..."). The README has no separate licence note for the No-Intro folder (grepped for licen, copyright, legal, redistribut, attribution; nothing carves No-Intro out).
- Do not match by name alone. The GBC DAT also holds "Pokemon - Sapphire Version (USA)", a 2097152-byte entry whose ROM file is named "(Unl).gbc". It is an unlicensed Game Boy Color release, not the GBA game. The GBA DAT also holds "Pokemon - Sapphire Version - Gotta Catch 'em All! (USA) (Pirate)" (33554432 bytes). Both are out of scope.

### Hash table (No-Intro values, lowercase)

| Revision | No-Intro entry name | CRC32 | SHA-1 (No-Intro) | pret SHA-1 match |
|---|---|---|---|---|
| Red (English) | Pokemon - Red Version (USA, Europe) (SGB Enhanced) | 9f7fdd53 | ea9bcae617fdf159b045185467ae58b2e4a48b9a | yes |
| Blue (English) | Pokemon - Blue Version (USA, Europe) (SGB Enhanced) | d6da8a1a | d7037c83e1ae5b39bde3c30787637ba1d4c48ce2 | yes |
| Yellow (English) | Pokemon - Yellow Version - Special Pikachu Edition (USA, Europe) (CGB+SGB Enhanced) | 7d527d62 | cc7d03262ebfaf2f06772c1a480c7d9d5f4a38e1 | yes |
| Gold (English) | Pokemon - Gold Version (USA, Europe) (SGB Enhanced) (GB Compatible) | 6bde3c3e | d8b8a3600a465308c9953dfa04f0081c05bdcb94 | yes |
| Silver (English) | Pokemon - Silver Version (USA, Europe) (SGB Enhanced) (GB Compatible) | 8ad48636 | 49b163f7e57702bc939d642a18f591de55d92dae | yes |
| Crystal 1.0 | Pokemon - Crystal Version (USA) | ee6f5188 | f4cd194bdee0d04ca4eac29e09b8e4e9d818c133 | yes |
| Crystal 1.1 | Pokemon - Crystal Version (USA, Europe) (Rev 1) | 3358e30a | f2f52230b536214ef7c9924f483392993e226cfb | yes |
| Crystal Australian | Pokemon - Crystal Version (Australia) | bb6dd80c | a0fc810f1d4e124434f7be2c989ab5b5892ddf36 | yes |
| Ruby 1.0 | Pokemon - Ruby Version (USA, Europe) | f0815ee7 | f28b6ffc97847e94a6c21a63cacf633ee5c8df1e | yes |
| Ruby 1.1 | Pokemon - Ruby Version (USA, Europe) (Rev 1) | 61641576 | 610b96a9c9a7d03d2bafb655e7560ccff1a6d894 | yes |
| Ruby 1.2 | Pokemon - Ruby Version (USA, Europe) (Rev 2) | aeac73e6 | 5b64eacf892920518db4ec664e62a086dd5f5bc8 | yes |
| Ruby German 1.0 | Pokemon - Rubin-Edition (Germany) | 15e1e280 | 1c2a53332382e14dab8815e3a6dd81ad89534050 | yes |
| Ruby German 1.1 | Pokemon - Rubin-Edition (Germany) (Rev 1) | cae89464 | 424740be1fc67a5ddb954794443646e6aeee2c1b | yes |
| Sapphire 1.0 | Pokemon - Sapphire Version (USA, Europe) | 554dedc4 | 3ccbbd45f8553c36463f13b938e833f652b793e4 | yes |
| Sapphire 1.1 | Pokemon - Sapphire Version (USA, Europe) (Rev 1) | bafedae5 | 4722efb8cd45772ca32555b98fd3b9719f8e60a9 | yes |
| Sapphire 1.2 | Pokemon - Sapphire Version (USA, Europe) (Rev 2) | 9cc4410e | 89b45fb172e6b55d51fc0e61989775187f6fe63c | yes |
| Sapphire German 1.0 | Pokemon - Saphir-Edition (Germany) | 6fcd7a98 | 5a087835009d552d4c5c1f96be3be3206e378153 | no (pret has fa0bd1abe04fea17016f585454d0f1392f342a21) |
| Sapphire German 1.1 | Pokemon - Saphir-Edition (Germany) (Rev 1) | b0c40c7c | 7e6e034f9cdca6d2c4a270fdb50a94def5883d17 | yes |
| Emerald (English) | Pokemon - Emerald Version (USA, Europe) | 1f1c08fb | f3ae088181bf583e55daf962a92bb46f4f1d07b7 | yes |
| FireRed 1.0 | Pokemon - FireRed Version (USA, Europe) | dd88761c | 41cb23d8dccc8ebd7c649cd8fbb58eeace6e2fdc | yes |
| FireRed 1.1 | Pokemon - FireRed Version (USA, Europe) (Rev 1) | 84ee4776 | dd5945db9b930750cb39d00c84da8571feebf417 | yes |
| FireRed Switch (pret `firered_switch`) | Pokemon - FireRed Version (USA, Europe) (Rev 10) (Switch) | 31554c22 | baa452d0b24629dd7782cfc07a8984085dde1311 | yes |
| LeafGreen 1.0 | Pokemon - LeafGreen Version (USA, Europe) | d69c96cc | 574fa542ffebb14be69902d1d36f1ec0a4afd71e | yes |
| LeafGreen 1.1 | Pokemon - LeafGreen Version (USA, Europe) (Rev 1) | daffecec | 7862c67bdecbe21d1d69ce082ce34327e1c6ed5e | yes |
| LeafGreen Switch (pret `leafgreen_switch`) | Pokemon - LeafGreen Version (USA, Europe) (Rev 10) (Switch) | 49ddf652 | 62b9fc77549dbc67032eb6cbd0ea6ad3b825690f | yes |

The match column compares the lowercase No-Intro SHA-1 with the SHA-1 in the pret file for the same build. The comparison was done by script on the downloaded DATs and the pret files read at the pinned commits.

### Sizes (No-Intro, bytes)

Read on 2026-11-14 from the same three DAT files, by exact entry name. Every in-scope Game Boy entry is 1,048,576 bytes, every in-scope Game Boy Color entry 2,097,152 and every in-scope Game Boy Advance entry 16,777,216.

| No-Intro entry name | Size |
|---|---|
| Pokemon - Red Version (USA, Europe) (SGB Enhanced) | 1,048,576 |
| Pokemon - Blue Version (USA, Europe) (SGB Enhanced) | 1,048,576 |
| Pokemon - Yellow Version - Special Pikachu Edition (USA, Europe) (CGB+SGB Enhanced) | 1,048,576 |
| Pokemon - Gold Version (USA, Europe) (SGB Enhanced) (GB Compatible) | 2,097,152 |
| Pokemon - Silver Version (USA, Europe) (SGB Enhanced) (GB Compatible) | 2,097,152 |
| Pokemon - Crystal Version (USA) | 2,097,152 |
| Pokemon - Crystal Version (USA, Europe) (Rev 1) | 2,097,152 |
| Pokemon - Crystal Version (Australia) | 2,097,152 |
| Pokemon - Ruby Version (USA, Europe) | 16,777,216 |
| Pokemon - Ruby Version (USA, Europe) (Rev 1) | 16,777,216 |
| Pokemon - Ruby Version (USA, Europe) (Rev 2) | 16,777,216 |
| Pokemon - Rubin-Edition (Germany) | 16,777,216 |
| Pokemon - Rubin-Edition (Germany) (Rev 1) | 16,777,216 |
| Pokemon - Sapphire Version (USA, Europe) | 16,777,216 |
| Pokemon - Sapphire Version (USA, Europe) (Rev 1) | 16,777,216 |
| Pokemon - Sapphire Version (USA, Europe) (Rev 2) | 16,777,216 |
| Pokemon - Saphir-Edition (Germany) | 16,777,216 |
| Pokemon - Saphir-Edition (Germany) (Rev 1) | 16,777,216 |
| Pokemon - Emerald Version (USA, Europe) | 16,777,216 |
| Pokemon - FireRed Version (USA, Europe) | 16,777,216 |
| Pokemon - FireRed Version (USA, Europe) (Rev 1) | 16,777,216 |
| Pokemon - FireRed Version (USA, Europe) (Rev 10) (Switch) | 16,777,216 |
| Pokemon - LeafGreen Version (USA, Europe) | 16,777,216 |
| Pokemon - LeafGreen Version (USA, Europe) (Rev 1) | 16,777,216 |
| Pokemon - LeafGreen Version (USA, Europe) (Rev 10) (Switch) | 16,777,216 |

## 3. Cross-check result

- Match for 24 of 25: Red, Blue, Yellow, Gold, Silver, Crystal 1.0, 1.1 and Australian, Ruby 1.0, 1.1, 1.2, Ruby German 1.0 and 1.1, Sapphire 1.0, 1.1, 1.2, Sapphire German 1.1, Emerald, FireRed 1.0, 1.1 and Switch, LeafGreen 1.0, 1.1 and Switch.
- The three the task asked for by name all match: FireRed USA 1.0 (41cb23d8...), Emerald USA (f3ae0881...), Crystal USA 1.1 (f2f52230...).
- Mismatch: Sapphire German 1.0. pret `sapphire_de.sha1` says `fa0bd1abe04fea17016f585454d0f1392f342a21`. No-Intro "Pokemon - Saphir-Edition (Germany)" says `5a087835009d552d4c5c1f96be3be3206e378153` (CRC32 `6fcd7a98`). The pret value appears in none of the three DATs.
- What is known about the mismatch: pret added `sapphire_de.sha1` once, in commit c6e9dd8a2a (2017-07-09, "Build German Sapphire (1.0)"), and never changed it. The German Ruby 1.0 and 1.1 and German Sapphire 1.1 files match No-Intro. A GitHub issue search in pret/pokeruby for the No-Intro SHA-1 and for "german sapphire sha1" found nothing.
- What is not known: which of the two is the retail ROM. I had no ROM to hash. Reading No-Intro as the retail dump is the usual assumption, because No-Intro catalogues verified dumps of retail cartridges (unverified here). Do not copy pret's `sapphire_de.sha1` into a profile without a second source.
- A profile that lists SHA-1 for German Sapphire 1.0 should use the No-Intro value, or omit SHA-1 for that revision and rely on CRC32 plus the ROM header (unverified suggestion; a design call for the schema ticket, not for this research).

## 4. No-Intro and DAT-o-MATIC terms

Not researched. The research run stopped at an API rate limit before this part. Read DAT-o-MATIC's terms before the release candidate.

## 5. What mGBA's `emu:checksum(C.CHECKSUM.CRC32)` covers

Checked by the main thread on 2026-11-14 at mgba-emu/mgba `d58ea8a86f30598fbf3958585de3d33028535072`.

- GBA: `src/gba/gba.c` line 475 sets `gba->romCrc32 = doCrc32(gba->memory.rom, gba->pristineRomSize);`, and line 432 sets `pristineRomSize` from `vf->size(vf)`, the size of the ROM file. Lines 440 to 451 special-case files over 32 MiB and files of exactly 1 MiB. Every in-scope GBA entry in the size table of part 2 is 16,777,216 bytes, so the CRC32 covers the whole file, as No-Intro's does.
- GB: `src/gb/gb.c` line 229 sets `gb->romCrc32 = doCrc32(gb->memory.rom, gb->memory.romSize);`. Whether `romSize` equals the file size for the 1 MiB and 2 MiB Pokémon ROMs was not checked.
- `src/gba/core.c` line 703 returns `romCrc32` for `mCHECKSUM_CRC32`.
- Nobody has run this against a real ROM yet. The first live mGBA run confirms it.

## Open gaps

- No-Intro's DAT-o-MATIC terms (part 4).
- Which German Sapphire 1.0 SHA-1 belongs to the retail ROM (part 3).
- Whether mGBA's GB `romSize` equals the file size (part 5).
