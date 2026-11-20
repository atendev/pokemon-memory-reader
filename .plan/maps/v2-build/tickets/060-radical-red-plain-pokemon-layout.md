---
type: research
blocked_by: []
---

# Does Radical Red keep Pokémon plain in RAM, and what must the hack profile declare?

## Question

HITL. [Does Radical Red's Nature Changer keep personality % 25 true?](./056-radical-red-nature-changer-save.md) found that Radical Red 4.1 writes party Pokémon to the save with no encryption, no substructure shuffle and a zero checksum word, on one Pokémon. The Gen 3 decoder from [Gen 3 party decoder](./008-gen3-party-decoder.md) decrypts and unshuffles every Pokémon. With the owner's Radical Red 4.1 ROM in mGBA, read the party through the bridge or a memory dump and compare it with the save layout. Say whether RAM matches the save, whether boxes match, and what the hack profile has to declare (a plain-layout flag on the Pokémon data format, or a decoder switch). Say whether other CFRU hacks share it. Don't commit ROM or save bytes.

## Answer

Party Pokémon are plain in RAM as well as in the save (tested on Radical Red 4.1 only), and a CFRU hack profile declares nothing extra for it. Boxes are not settled and become [ticket 061](./061-cfru-box-storage-layout.md).

**Evidence (2026-11-20, with the owner).** mGBA 0.10.5 ran copies of the Radical Red 4.1 ROM and save from `/tmp`, so the originals were untouched. With the save loaded in the overworld, a throwaway Lua script scanned EWRAM for the saved party Pokémon's personality and trainer ID. It found two copies, at `0x02024284` and `0x02025564`. The first matches the usual `gPlayerParty` address, and the second is `0x12E0` higher, which would fit a mirror in the save block (a guess from the address, not checked). The 100 bytes at `0x02024284` are identical to that Pokémon's record in the save, with a zero checksum word. Only the first copy was compared, and only one level 6 Pokémon was tested. No ROM or save bytes are committed.

**What the profile declares.** `dataFormat: "cfru"` and nothing else. Radical Red is the only hack tested on a ROM. For every other CFRU-based hack the rule rests on the source evidence below, so each hack profile's own fixture (the CFRU fog) confirms it before that profile ships as supported. [The research](../assets/060-cfru-plain-layout-research.md) found that CFRU's decryption patch is unconditional in its `bytereplacement` file and applied to every build by `scripts/insert.py`, so the plain layout belongs to the data format, not to each hack. The `cfru` decoder reads flat 100-byte party records with no decryption, no shuffle and no checksum check. Unbound is corroborated only by a third-party repo (`ub_pokemon.h`), and Dark Violet looks like a non-CFRU base, so neither is assumed.

**Boxes.** Nothing was confirmed. A scan of the save's PC sectors with the vanilla 14-box, 80-byte layout found no valid Pokémon, but that scan can't see CFRU's different records, so it says nothing either way about whether the save has boxed Pokémon. The owner has one party Pokémon and no second one to deposit. The research says CFRU stores boxed Pokémon as 58-byte compressed records across 25 boxes, with boxes 20 to 25 at separate addresses. That is hand-derived and unchecked. The `cfru` box decoder must not reuse the 80-byte Gen 3 `BoxPokemon` reader. Ticket 061 checks it against a real box.

**Excluded.** A plain-layout flag on the `gen3` format (it would duplicate `cfru`), and detecting the layout from the checksum word at run time (a real checksum can be zero by chance).

**Left open.** Whether other CFRU hacks match was not tested on a ROM, and RAM and the save were compared on one Pokémon only.

Timing: unavailable (wf-time.py found no transcript for this thread).
