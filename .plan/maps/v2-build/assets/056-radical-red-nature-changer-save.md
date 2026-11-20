# Radical Red Nature Changer: save test

Run 2026-11-20 by the owner on Radical Red 4.1 in mGBA 0.10.5, with one Pokémon in the party. The owner read the nature off the in-game summary screen and saved in-game before and after using the Nature Changer NPC. No ROM or save bytes are committed here. Only the two personality values and the decoded fields below are quoted.

## Method

1. Save A: the Pokémon's summary showed Rash. In-game save.
2. The Nature Changer set it to Jolly. The summary showed Jolly. In-game save.
3. A throwaway reader (not committed) found the newest of the two save slots by save index, took section 1 (team), and read the party count at `0x34` and each 100-byte Pokémon from `0x38`, the FireRed/LeafGreen layout. It printed the personality, personality % 25 and the nature name for each.

## Result

| State | Shown nature | Personality | Personality % 25 |
| --- | --- | --- | --- |
| Before | Rash | `0x0b60202d` | 19 = Rash |
| After | Jolly | `0xe7f58fbd` | 13 = Jolly |

- The summary nature matched personality % 25 both times. The NPC rewrites the Pokémon's personality value. The OT id stayed the same. The save index went 1 to 2 between the two saves, so the second save is the newer slot.
- A byte diff of the whole 100-byte party record between the two saves (the older slot before, the newer slot after) shows changes only at the 4 personality bytes and at three stat bytes (offsets 94, 96, 98: Speed, Sp. Atk, Sp. Def, the stats Rash and Jolly weigh differently). The 48 data bytes, the OT id, the level and the other fields did not change. So no other field in the record holds a nature, and nothing in the record encodes the change except personality and the recalculated stats. Other bytes in the team section changed too, at section offsets 1723 to 1952, past the party area (which ends at 656). Those were not identified, so a nature stored outside the record is not ruled out.
- Scope: one Pokémon, one change, party storage only. Boxes and a second Nature Changer use were not tested.

## Side finding: party Pokémon are plain in the save

- The personality changed, so a vanilla Gen 3 save would re-encrypt the 48 data bytes with a new key (personality xor OT id). The 48 data bytes at offset `0x20` stayed byte for byte the same across the two saves.
- Read as plain Gen 3 growth, attacks, EVs, misc blocks in that order, they decode to sensible values: a Chikorita (species 152) holding an item, level 6, with Tackle, Growl and Razor Leaf. Both personalities give pid % 24 = 13, which is the EGMA order in a vanilla save (effort block first, growth second), but the growth block is first here. So the blocks are not shuffled either.
- The checksum word at offset `0x1C` is 0 in both saves, where a vanilla save stores the sum of the data words.
- So in this save, Radical Red 4.1 stores party Pokémon with no encryption, no substructure shuffle and no checksum. This was seen on one Pokémon in the save file only. Live RAM, boxes, and other CFRU hacks are not checked. The mGBA bridge reads RAM, where the layout could differ.
- Effect on the build: the Gen 3 decoder from [Gen 3 party decoder](../tickets/008-gen3-party-decoder.md) decrypts and unshuffles unconditionally, so it would mis-decode a Radical Red Pokémon if the RAM layout is plain too. A live read through the bridge would settle that. See the surfaced ticket.

## Limits

- The reader's party offsets assume the FireRed/LeafGreen section layout. They produced a plausible Pokémon (a real species with its level 6 moves), which is the check that the offsets are right.
- The save files stay on the owner's machine, outside the repo.
