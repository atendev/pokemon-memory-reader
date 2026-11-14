# Decision report: Where does reference data come from?

Ticket: [Where does reference data come from?](../tickets/019-reference-data-source.md), a grilling ticket for spec §17 item 7. The result is [the amendment](./019-reference-data-amendment.md). In this report, "part N" means the amendment's section N, and "§N" means a spec section.

Audit verdict: APPROVE in round 5 of 5, from one haiku auditor kept across every round.

## Decisions the owner made

The owner answered each question through AskUserQuestion. The main thread wrote every question, its options and its recommendation.

| # | Question | Options | Recommended | Chosen |
|---|---|---|---|---|
| 1 | Which name text, and from which source? | Game text from pret; modern names from PokeAPI; dump from the owner's ROMs | Game text from pret | Game text from pret |
| 2 | Which languages ship reference data in v2.0? | English only; English and German; English plus owned ROMs | English only | English only |
| 3 | Where do growth-curve values come from? | Formulas in code; tables from pret | Formulas in code | Formulas in code |
| 4 | Where do `identify.sha1` and `crc32` lists come from? | pret SHA-1 plus No-Intro CRC32; the owner's ROMs only; No-Intro for both | pret SHA-1 plus No-Intro CRC32 | pret SHA-1 plus No-Intro CRC32 |
| 5 | How are tables keyed? | Per data format with locations by `artVersion`; per data format with a new `game` field; everything per game | Per data format, locations by `artVersion` | Per data format, locations by `artVersion` |
| 6 | What happens to a profile in a language with no shipped data? | Reject at load; load with names null; fall back to English | Reject at load | Reject at load |
| 7 | How are strings of Japanese-language mons decoded in English Gen 3 games? | The kana set; null | The kana set | The kana set |
| 8 | Final check of the whole summary | Write it up; change something | Write it up | Write it up |

Round 1 asked questions 1 to 3, round 2 asked 4 to 7, and round 3 asked question 8. Option 4's text named the generator's cross-check, the rule for a disagreement and the test that needs both hash lists. Question 8 restated those and the rules in the next section, and the owner accepted all of them.

## Rules the main thread derived

These follow from the owner's answers or the License decision. The owner saw each one in the round 3 summary unless marked otherwise.

- Generator output and generator tests hold no pret C or assembly. Tests use hand-written lines in pret's syntax, and the profile generator's `.sym` excerpts stay allowed. This applies the License decision's no-copy rule to the new generator.
- The generator fails when two repos of one data format disagree on a shared ID. Only this check makes "one table per data format" safe, because the research compared constant names and list positions, not resolved IDs.
- A location ID that its `artVersion` table doesn't name gives a `null` name, as other names do in §5.5.
- A disagreement between pret and No-Intro leaves that revision without hashes. German Sapphire 1.0 is the only case, and German isn't in v2.0.
- A test fails when a built-in official profile has an empty `sha1` or `crc32` list. The mGBA bridge always sends a CRC32, and §5.4 treats an unmatched hash as a modified ROM.
- Added after the audit, not in the round 3 summary: ID 0 placeholders and non-item entries get no name. A name the game builds at runtime, such as a Gen 1 TM name, follows the game's rule. Tables omit fields a data format lacks. Gen 1 and Gen 2 need no growth formulas in v2.0, because their structs store the level. These close gaps without changing an owner decision.
- CONTEXT.md now lists abilities and locations under Reference data, puts experience curves in code under Species data, and says the art version also picks location names. No ADR. The amendment holds the reasoning, and earlier tickets used amendments the same way.

## Facts behind the decisions

- pret's per-revision SHA-1 files cover all 25 retail revisions pret builds. No-Intro, mirrored in libretro-database (CC BY-SA 4.0), has CRC32 and SHA-1 for all 25. 24 SHA-1 values match pret's, and German Sapphire 1.0 differs ([hash research](./019-reference-data-hashes.md)).
- Gen 3 species, move and ability names match across pokeruby, pokeemerald and pokefirered. Item names match at every shared list position. Location tables differ by game ([Gen 3 checks](./019-reference-data-pret-gba.md)).
- Gen 1 names match in pokered and pokeyellow. Gen 2 was not researched ([Gen 1-2 research](./019-reference-data-pret-gb.md)).
- pret's Gen 3 charmap maps 161 kana beside the Latin set, and pret computes its Gen 3 experience tables from six formula macros.
- mGBA computes the GBA CRC32 over the whole ROM file (`src/gba/gba.c` lines 432 and 475 at `d58ea8a`), and No-Intro lists every in-scope GBA dump at 16,777,216 bytes.

## Audit

The auditor ran on haiku, as one subagent for every round.

- Round 1 returned 12 problems. The main thread accepted all of them and changed the text:
  1. The `MOVE_NONE` placeholder broke the "names match" claim. part 2 now skips ID 0 placeholders.
  2. "In-scope" was undefined. part 7 now defines it as the 25 retail revisions pret builds, and part 12 says English revisions.
  3. Gen 1 growth rates had no source. part 6 now limits the curves to Gen 3 and CFRU boxed mons.
  4. The item and name agreement claims overstated the checks. parts 4 and 10 now say constant names and list positions.
  5. The no-copy rule conflicted with one-line quotes in the research notes. part 1 now scopes it to generator output and tests.
  6. The GB checksum fact and the 16 MiB premise lacked sources. parts 7, 10 and 13 now cite No-Intro's sizes and flag the GB path as unchecked.
  7. to 10. CONTEXT.md and the amendment disagreed on curves, keys and "game family". Both now use `artVersion` values, and the glossary matches.
  11. and 12. Fields Gen 1 lacks, and Gen 1 TM, HM and floor-name entries, had no rule. parts 1 and 2 now give one.
- Round 2 closed objections 2, 3, 4, 7, 8 and 11, and the TM and HM part of 12. It left 1, 5, 6, 9, 10 and 12 open and added three new problems. The main thread accepted all of them:
  - 1. Part 10 now names the `MOVE_NONE` exception.
  - 5. The quote exemption now allows short excerpts of a few lines, which matches the earlier research assets.
  - 6. The hash research now records the No-Intro size of all 25 entries, and the amendment and the asset's part 5 cite that table.
  - 9. Part 9 now says "the table for the profile's `artVersion`".
  - 10. CONTEXT.md now keys tables by data format and language, and location names by art version and language.
  - 12. Part 2 now defines a name table's range as IDs 1 to the last ID of its kind, writes filler names such as `MISSINGNO.` and `?????` as the game prints them, and skips ID 0 and non-items such as floor names.
  - New 1. The text now says pokeruby and pokefirered match by numeric ID resolved from their `#define` lines, and part 12 lists how to resolve Emerald's item IDs.
  - New 2. Part 1 now says Gen 1 species tables hold no types and points to the table in spec §6.3. The amendment now calls its own sections "part N", so "§N" always means the spec.
  - New 3. Part 10 now lists the Gen 1-2 stored-level fact as not checked.
- Round 3 closed objections 1, 5, 6, 9 and 10, and closed 12, N1 and N2 in form. It left nine narrower problems, and the main thread fixed each one:
  - The glossary now says Gen 1 types come with each Pokemon, and part 1 quotes amendment 016 §5 on Gen 1 types.
  - Part 10 no longer claims the stored-level fact is confirmed, and it now describes how each item comparison was done.
  - The Gen 3 asset now records how the script resolved Ruby/Sapphire and FireRed/LeafGreen item IDs.
  - The size sentences say "in-scope", and the hash asset's source line covers the 2026-11-14 read.
  - Part 2 now says "reference table" instead of the glossary's "name table", drops the unsourced reason for filler names (part 10 lists it as not checked), and runs Gen 3 items to Emerald's last ID, 376.
- Round 4 closed seven of the nine round-3 items and left two. Part 2 had stated Emerald's last list position as a confirmed item ID, and part 7's Game Boy size sentence lacked "in-scope". The main thread fixed both: part 2 now bounds the range by resolved numeric IDs, and part 7 now says "in-scope".
- Round 5 returned `APPROVE` with no new problems. The auditor confirmed the quote from amendment 016 against its line 140, which sits under that amendment's part 5 heading.

## Process notes

- The parent session ran the Jev audit, so this thread skipped it as instructed. The master's brief replaced the runner's commit question with "commit every time", and this thread left `map.md` alone.
- `why` ran inline instead of with parallel investigators. Five of its seven evidence categories have no connected MCP, and the other two are this repo's git history and `.plan` tracker. It found that the License ticket (commit `4f59a95`, 2026-11-11) forbids copying pret source, because no pret repo has a license file, while it treats addresses and offsets as facts. The build map's generator assumption (commit `5d6560b`) extends the profile generator's pattern from §5.3.
- `blast-radius` found no code to break, since the workspace holds only the skeleton. The decision touches spec §5.1, §5.3 to §5.6, §6.2, §6.3, §12.6, §14 and §17 item 7, amendment 016 §5, and the build tickets Emerald profile and generator, Gen 3 party decoder and First live run on mGBA. The CRC32 choice rests on one fact, that mGBA hashes the whole ROM file. The source lines show it, and the first live run confirms it.
- All three research subagents ran on sonnet and stopped at an API rate limit. The hash research was complete except for the DAT-o-MATIC terms. The Gen 1-2 research finished Gen 1 only. The Gen 3 research wrote nothing, so the main thread ran scripts over the files it had fetched.
- The repo doesn't use pull requests for this work, so the branch goes up without one. CI runs on every push.
