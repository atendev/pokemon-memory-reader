---
type: research
blocked_by: []
assets: [../assets/016-icon-source.md]
---

# Icon and sprite source

## Question

Which community icon source is acceptable as the viewer's default, and what are the terms for loading it at runtime?

[Viewer design](./008-viewer-design.md) loads type, item, ball and Pokemon icons at runtime from a community source, and PokeAPI sprites stand in for it. Check the PokeAPI sprites repo and the alternatives: their licenses, stated stance on Nintendo art, hotlinking and rate limits, coverage of items, balls and ROM-hack species, and whether users can reasonably mirror it themselves. A follow-up decision ticket graduates from the findings.

## Answer

PokeAPI/sprites is the best default: it has items, Poke Balls, per-game type icons and gen 3 menu icons for species 1-386, laid out by PokeAPI IDs and slugs. Its `LICENCE.txt` says the images are "Copyright The Pokémon Company" while the repository is CC0, so no source licenses the art and use is tolerated, not granted. The README invites bulk download but sets no hotlink terms or rate limit, and raw.githubusercontent.com and jsDelivr both serve the files with open CORS. msikma/pokesprite (MIT code, Nintendo images) is the fallback for items but lacks gen 3 icons. Showdown, Bulbagarden Archives and Serebii state no reuse terms, so they are not suitable. No source covers gen 1-2 box icons or ROM-hack species such as Radical Red forms. The follow-up decision needs to settle: the default base URL (raw vs jsDelivr vs a user-run mirror), a disk cache so the viewer fetches each icon once, a configurable base URL for user packs, and the fallback for ROM-hack and gen 1-2 species (name text or a user pack).
