---
type: research
blocked_by: []
---

# How does Radical Red store boxed Pokémon in RAM and in the save?

## Question

HITL. [Does Radical Red keep Pokémon plain in RAM](./060-radical-red-plain-pokemon-layout.md) settled the party and left boxes open. [The research](../assets/060-cfru-plain-layout-research.md) says CFRU keeps boxed Pokémon as 58-byte compressed records across 25 boxes, with boxes 1 to 19 at `gPokemonStorage+4` and boxes 20 to 25 elsewhere. That is hand-derived and unchecked. A vanilla-layout scan of the owner's save found no boxed Pokémon, but that scan can't see CFRU's records, so whether the save holds any is unknown.

With the owner's Radical Red 4.1 ROM in mGBA, put at least two Pokémon in different boxes (one in box 1 and one in a box past 19 if the owner can), save, and scan RAM and the save for them. Say what the record size and field order are, where each box lives in RAM and in the save, and what the `cfru` box decoder and the hack profile's `boxes` block have to declare. Also say whether `features.boxes` for a built-in hack can default on. Don't commit ROM or save bytes.
