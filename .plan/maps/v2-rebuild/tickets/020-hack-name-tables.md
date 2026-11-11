---
type: grilling
blocked_by: [010]
assets: []
---

# ROM hack name tables

## Question

How does a hack's game profile get species, move, item and ability names?

[How ROM hacks extend reference data](./010-hack-reference-data.md) found that names sit in Gen 3-charmap tables at hack-specific addresses. Choose between profiles that declare table addresses and strides so names are read from ROM at attach time, and profiles that ship per-hack JSON name arrays dumped from the owner's ROMs. Settle who produces the data for closed-source hacks, what happens when a bridge can't read cartridge address space, and how unknown IDs show up in the API.
