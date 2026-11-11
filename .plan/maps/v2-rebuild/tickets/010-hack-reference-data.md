---
type: research
blocked_by: []
assets: [../assets/010-hack-reference-data.md]
---

# How ROM hacks extend reference data

## Question

Where do hacks that add species, moves or items (Radical Red and other CFRU hacks, plus decomp-based hacks) keep their extended name tables, and in what format can a profile read them from memory or ship them?

Surface the facts a decision waits on: table locations and encodings, which hacks are in reach, and whether names can be read live from the ROM image in emulated memory. A follow-up decision ticket graduates from the findings.

## Answer

Gen 3 hacks keep names in the same Gen 3 character map (0xFF-terminated, fixed-width entries padded with 0xFF) but at hack-specific addresses. CFRU and Dynamic Pokemon Expansion hacks use flat arrays indexed by u16 ID (species 11 bytes, moves 13 bytes, abilities 17 bytes in CFRU), and they repoint the vanilla ROM header pointers at `0x08000144` (species names) and `0x080001C0` (abilities). They do not repoint the header's move-name pointer at `0x08000148`, so move names need a profile-declared address. pokeemerald-expansion hacks put names inside `gSpeciesInfo` (inline, config-dependent stride), `gMovesInfo` and `gItemsInfo` (pointers), reachable from the header's `.speciesInfo`, `.moves` and `.items` pointers but needing a build-specific layout. Names can be read live from ROM at `0x08000000` if the bridge or adapter exposes cartridge address space, which this ticket did not verify per emulator, and no real Radical Red or other hack ROM was inspected. A follow-up decision needs to settle whether profiles declare table addresses and strides and read names from ROM at attach time, or ship per-hack JSON name arrays dumped from the owner's ROMs, and who produces them for closed hacks.
