---
type: research
blocked_by: []
assets: []
---

# What decomp symbol data provides

## Question

What can the pret decompilation projects give a game profile, and how reliably?

Cover pokered, pokeyellow, pokegold, pokecrystal, pokeruby, pokeemerald, and pokefirered. Find:

- Which symbol or map files they publish or produce on build (`.sym`, `.map`, ELF), and whether prebuilt ones exist or a build is needed.
- Which ROM revisions and regions each project builds (Ruby v1.0, v1.1, v1.2, non-USA releases, FireRed v1.1), and how each is selected.
- Whether struct layouts (party Pokemon, box Pokemon, save blocks, bag pockets, battle structs) can be extracted mechanically from headers or debug info, or need writing by hand.
- How save block pointers (Emerald and FireRed relocate their save blocks) and battle state variables appear in the symbols.
- Whether ROM hacks built on these decomps ship symbol files, and how CFRU and DPE hacks such as Radical Red differ (CFRU patches a binary instead of building from the decomp).
- The license of each repo, and whether addresses or layouts derived from them can be bundled in a GPL program.
