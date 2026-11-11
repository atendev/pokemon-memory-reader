---
type: research
blocked_by: []
assets: [../assets/002-decomp-symbol-data.md]
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

## Answer

Every pret repo in scope publishes a prebuilt `symbols` branch, so a profile generator can download symbols without building anything. Game Boy repos (pokered, pokeyellow, pokegold, pokecrystal) give `.sym` and `.map` files with `bank:address label` lines and no sizes, while GBA repos (pokeruby, pokeemerald, pokefirered) give objdump style `.sym` files with sizes and, for Ruby and FireRed, one file per revision (rev1, rev2, German, rev10 Switch). Emerald has a single English file. Struct layouts are not in the symbols; the ELFs with debug info are not published, so field offsets must be written by hand from the C headers and RGBDS macros, once per generation. Emerald and FireRed expose `gSaveBlock1Ptr`, `gSaveBlock2Ptr`, and `gPokemonStoragePtr` as IWRAM pointers that must be dereferenced at read time, as must `gBattleStruct` and `gBattleResources`, while Ruby/Sapphire save blocks are static addresses. Battle variables such as `gBattleMons`, `gBattleTypeFlags`, and `gPlayerParty` are plain named symbols. CFRU and Radical Red patch a vanilla FireRed 1.0 ROM through `BPRE.ld` and a generated `offsets.ini`, so there is no general hack symbol file and each hack needs its own profile. None of the seven pret repos has a license file, so bundling derived addresses rests on treating them as facts and recording provenance; this needs a decision (unverified legal reading). No existing tool that generates address tables from pret symbols turned up. Details and sources are in [the asset file](../assets/002-decomp-symbol-data.md).
