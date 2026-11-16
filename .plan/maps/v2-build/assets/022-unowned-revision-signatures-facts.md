# Facts for 022: signatures on revisions the owner doesn't own

Read 2026-11-16 through `gh api` at the commits pinned in [019 hashes](./019-reference-data-hashes.md). No ROM was read.

- pret builds are byte-identical to retail when `make compare` passes. 24 of the 25 pret Gen 3 `.sha1` values equal the No-Intro SHA-1. Sapphire German 1.0 does not (pret `fa0bd1ab…`, No-Intro `5a087835…`).
- Gen 3 revisions pret builds: Ruby and Sapphire 1.0, 1.1, 1.2, German 1.0, German 1.1; FireRed and LeafGreen 1.0, 1.1, Switch (Rev 10); Emerald English.
- pokefirered has `src/rom_header_gf.c`, like pokeemerald, so FireRed/LeafGreen carry `struct GFRomHeader`.
- pokeruby has no `rom_header_gf.c`. Its GF header lives in `src/crt0.s` and points to `gMonFrontPicTable`, `gMonBackPicTable`, `gMonPaletteTable`, `gMonShinyPaletteTable`, `gMonIconTable`, `gMonIconPaletteIndices`, `gMonIconPaletteTable`, `gSpeciesNames`, `gMoveNames` and `gDecorations`, then numeric constants. It holds no pointer to the species-info (base stats), item or move-data tables. Ruby/Sapphire can't use the three words Emerald's signature uses.
- The Emerald signature words were derived from `struct GFRomHeader` field offsets (0x1BC, 0x1C8, 0x1CC) and pret symbols, and have not been checked against a ROM ([005 report](./005-emerald-profile-and-generator-report.md)).
- Spec §5.4: on an exact hash match, a signature `mismatch` only logs a profile error. A failing or unreadable signature blocks only a header match, which happens only when the emulator gives no hash. mGBA and RetroArch give CRC32, and BizHawk gives SHA-1 on confirmed cores.
