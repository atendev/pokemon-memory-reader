---
type: grilling
blocked_by: [020]
assets: []
claimed_by: wayfinder-master v2-rebuild-master-1794532844
claimed_at: 2026-11-13T01:20:44Z
---

# Expansion hack data format

## Question

Does v2.0 support hacks built on pokeemerald-expansion, and if so, how does it decode them?

[ROM hack name tables](./020-hack-name-tables.md) lets a profile describe expansion name tables, but these hacks also change struct layouts, and the size of `gSpeciesInfo` entries depends on build config. Decide whether expansion becomes its own data format with its own decoder, how a profile gets per-build strides and field offsets (symbol or map files, a build-time generator, hand entry), which hacks are in reach given that closed ROMs ship no symbols, and what v2.0 says about expansion hacks if support waits.
