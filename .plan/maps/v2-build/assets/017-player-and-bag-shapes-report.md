# Decision report: What shapes do `player` and `bag` have?

Ticket: [017-player-and-bag-shapes](../tickets/017-player-and-bag-shapes.md). Amendment: [017-player-and-bag-shapes](./017-player-and-bag-shapes.md).

The ticket ran in auto mode on 2026-11-16 (UTC) as a child of wayfinder-master. The main thread wrote each question with options and a recommendation. A sonnet grilling subagent stood in for the owner and answered in three rounds. A haiku auditor checked the amendment and approved it in round 3. The griller accepted every recommendation and added notes, and the amendment includes those notes. The audit verdict for every row is APPROVE (round 3).

## Grilling decisions

"Griller" means the grilling subagent, which accepted the main thread's recommendation unless the row says otherwise.

| # | Question | Options | Choice | Notes added by the griller |
|---|---|---|---|---|
| 1 | Badges shape | boolean array; `Badge[]` with id, name, obtained; bitmask; `{ johto, kanto }` | `Badge[]` `{ id, name \| null, obtained }` | `id` is 0-based game order, and `.describe()` states the Gen 2 order |
| 2 | Gen 2 viewer badge row | two rows of eight; one row of 16; current region only | two rows, Johto above Kanto | break on `badges.length > 8`, not on generation |
| 3 | Map location shape | raw IDs plus `section`; section only; raw IDs only | `{ mapGroup \| null, mapNumber, x, y, section }` | Gen 1 section is null where no table entry exists, and Gen 2 section is the landmark |
| 4 | Play time shape | `{ hours, minutes, seconds, frames }`; total seconds; both | the struct as stored | the Gen 1 cap is 255 hours and Gen 2-3 is 999, and the maxed flag is not exposed |
| 5 | Trainer IDs and money | 16-bit `trainerId` plus nullable `secretId`; one 32-bit ID | 16-bit `trainerId`, `secretId` null in Gen 1-2, decoded `money` | none |
| 6 | Coins, gender, rival name | leave for v2.x; add now | v2.x | gender isn't needed by the viewer |
| 7 | Pocket list | closed enum; open enum; flat list with category | closed `PocketId` of five values | a future PC store becomes a separate field, not a pocket |
| 8 | Bag container | `{ pockets: Pocket[] }`; object keyed by pocket; bare array | `{ pockets }` with `{ id, capacity, items }` | only the pockets the game has, in game order |
| 9 | Bag entry | `{ item: Ref, quantity }`; with slot index and null slots | `{ item, quantity }` | stored Gen 3 key-item quantities stay, and Gen 2 HMs appear only when set |
| 10 | PC item storage | leave for v2.x; add a `pc` pocket | v2.x | none |
| 11 | Unreadable data | whole resource fails; null the fields | whole resource fails | an unknown item ID is not a failure |
| 12 | Gen 1 `section` | pokered town-map table with a null fallback; always null | the table with a null fallback | null for any map without an entry, interiors included |
| 13 | Gen 3 `section` source | `gMapHeader.regionMapSectionId` in RAM; generated table | RAM | key by the raw value, and read the location fields in one pass |
| 14 | Where per-game layout values live | the profile block; decoder constants | the profile block | none |
| 15 | Badge name source | hand-kept list by art version; generated where possible; no names | hand-kept list, null for hacks | null even when a hack keeps eight badges |
| 16 | Viewer badge display | labelled pips; badge icons | labelled pips | "Badge N" when the name is null |
| 17 | Number ranges | `hours` unbounded; bound at 999 | unbounded `hours`, 0-59 for the rest | a bounds failure is a whole-resource failure |
| 18 | Coordinates | stored step units; pixel or metatile units | stored units | a fixture checks the Gen 3 border offset and that the position stays live |
| 19 | Odd bag entries | keep; drop; fail the bag | keep as stored | item 0 is the only empty marker |
| 20 | Glossary terms | add Pocket and Map section; add nothing | add both | none |
| 21 | Gen 2 landmark source | RAM byte with generated-table fallback; always a table; ROM table | RAM byte, else table | landmark 0 gives a null name, and a fixture covers a map change |
| 22 | Gen 3 encryption key | nullable key offset in the profile; flag plus fixed offset | nullable offset, no plausibility check | hacks inherit it through `extends` |
| 23 | Gen 2 TM/HM item IDs | `gen2` reference data with an agreement check; by art version; hard-coded | `gen2` with the check | HMs go in the same table |
| 24 | Pocket `capacity` | most distinct entries, 57 for Gen 2 `tmhm`; null for `tmhm` | most distinct entries | `.describe()` says when a TM or HM counts |
| 25 | Nullable fields | always-present nullable keys; optional keys | always present, `.nullable()` | none |
| 26 | Viewer pocket list | order and presence from the response; five fixed tabs | from the response | add a fallback label for an unknown id |
| 27 | Gen 1 invalid BCD money | fail `player`; decode the raw nibble | fail `player` | only Gen 1 money is BCD |

## Audit decisions

The haiku auditor ran three rounds.

| Round | Objection | Decision | Made by |
|---|---|---|---|
| 1 | Gen 2 money is BCD, not binary | Rejected. pokecrystal's money routines work in binary against MAX_MONEY 999999. In round 2, §2 was reworded to "expected binary" and gated on the player fixture's money check | main thread, auditor accepted |
| 1 | The hand-kept badge list conflicts with 019 | Fixed. §3 records it as an explicit exception to 019 and gives the reason | main thread |
| 1 | No decision adds a hack `items` name table | Rejected. Spec §5.5 already requires it, and §5 now cites `nameTables.items` | main thread, auditor accepted |
| 1 | The quantity-0 rule conflicts with the Gen 2 TM rule | Fixed. "Keep as stored" covers slot pockets only | main thread |
| 1 | §7 widens 013's bad-pointer rule | Fixed. §7 restates the rule in 013's terms | main thread |
| 1 | 018's one-level merge is unclear for pocket overrides | Fixed. §6 says a hack restates the whole top-level key | main thread |
| 1 | Wrong cross-reference in §1 | Fixed. It now points to §4 | main thread |
| 1 | The CONTEXT.md id-space sentence is an implementation detail | Fixed. The sentence is dropped | main thread |
| 1 | Unverified facts have no gate or fallback | Fixed. A table gives a gate and a fallback for each fact | main thread |
| 1 | The date and report link may be wrong | Rejected. The UTC date matches claimed_at, and this report ships in the same commit | main thread, auditor accepted |
| 2 | The Sources paragraph names only §4 for fallbacks | Fixed. It now points to the table | main thread |
| 3 | none | APPROVE | auditor |

## Main-thread decisions

- No new tickets. The open build questions (the Gen 2 landmark source, the Gen 1 town-map table, the Gen 3 border offset and the profile key names) belong to the existing "rest of Gen 3" and "Gen 1 and Gen 2" fog in the map.
- Coins, gender, rival name and PC item storage are logged in the amendment for a v2.x map. The map's Out of scope already sends unlisted features there.
- The ticket's question doesn't ask about profile key names, so the amendment leaves them to the build tickets.

## Gates skipped

- The commit gate ran without asking the user, per the master's brief.
- The owner chose auto mode, so the grilling subagent answered for the owner.
