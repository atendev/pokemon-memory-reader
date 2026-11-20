---
type: research
blocked_by: []
---

# Does Radical Red keep Pokémon plain in RAM, and what must the hack profile declare?

## Question

HITL. [Does Radical Red's Nature Changer keep personality % 25 true?](./056-radical-red-nature-changer-save.md) found that Radical Red 4.1 writes party Pokémon to the save with no encryption, no substructure shuffle and a zero checksum word, on one Pokémon. The Gen 3 decoder from [Gen 3 party decoder](./008-gen3-party-decoder.md) decrypts and unshuffles every Pokémon. With the owner's Radical Red 4.1 ROM in mGBA, read the party through the bridge or a memory dump and compare it with the save layout. Say whether RAM matches the save, whether boxes match, and what the hack profile has to declare (a plain-layout flag on the Pokémon data format, or a decoder switch). Say whether other CFRU hacks share it. Don't commit ROM or save bytes.
