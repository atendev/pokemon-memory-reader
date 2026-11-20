---
type: research
blocked_by: []
assets: [../assets/056-radical-red-nature-changer-save.md, ../assets/056-radical-red-nature-changer-save-report.md]
---

# Does Radical Red's Nature Changer keep personality % 25 true?

## Question

HITL. [Does Radical Red store a nature apart from personality % 25?](./028-radical-red-nature-storage.md) found no public source for a stored nature and kept the personality % 25 default, but Radical Red's source is closed. With a real Radical Red save, use the Nature Changer NPC on a Pokémon and compare its shown nature with personality % 25 before and after. If they differ, find where the nature is stored and say what the hack profile must declare. Waits until the owner has a Radical Red ROM and save. Don't commit ROM or save bytes.

## Answer

Yes. After the Nature Changer, the summary nature matches personality % 25. The NPC rewrites the personality value, and the party record holds no separate nature field. [The findings](../assets/056-radical-red-nature-changer-save.md) hold the test.

- Radical Red 4.1 in mGBA: a Pokémon showed Rash with personality `0x0b60202d` (% 25 = 19, Rash). After the Nature Changer it showed Jolly with personality `0xe7f58fbd` (% 25 = 13, Jolly). Same OT id.
- The hack profile declares nothing for nature. The decoder keeps reading `nature` as personality % 25, as [the earlier ticket](./028-radical-red-nature-storage.md) left it.
- A byte diff of the 100-byte party record shows only personality and three recalculated stats changed, so no other field in the record holds a nature. Scope is one Pokémon and one change in party storage. Boxes, repeated changes and anything stored outside the record were not tested.
- Side finding: in the one save tested, this party Pokémon is stored with no encryption, no shuffle and a zero checksum word. The Gen 3 decoder would mis-read it if RAM is the same. [Does Radical Red keep Pokémon plain in RAM](./060-radical-red-plain-pokemon-layout.md) checks that and what the profile must declare.
- Excluded: a stored-nature field (not observed), committing ROM or save bytes.
