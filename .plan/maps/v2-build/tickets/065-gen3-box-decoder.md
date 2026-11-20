---
type: task
blocked_by: [062]
---

# Gen 3 box decoder and `boxes` schemas

## What to build

Build the vanilla Gen 3 box decoder and the `boxes` schemas, following spec §6.5 and §7.9. A Gen 3 box is 14 boxes of 30 slots, read as one contiguous `PokemonStorage` of about 33 KB, with `currentBox` as its first byte and box names of up to 8 characters. Box Pokémon use the `Pokemon` schema with `hp`, `maxHp`, `stats` and `status` null, and `level` computed from experience and the growth rate. A checksum failure or bad egg gives a `null` slot listed in `corruptSlots`, logged once per box index and slot until the game changes. A failed storage read makes every box unreadable and `currentBox` null.

Reuse the party decoder's substructure code. Do not build the CFRU box layout here: Radical Red appears to store 58-byte compressed records ([Radical Red box layout](./061-cfru-box-storage-layout.md)), and the `cfru` format gets its own decoder after that ticket. The `Box` and `boxes` types follow the API sync rules.

## Acceptance criteria

- The decoder returns 14 boxes of 30 slots on synthetic memory, with `null` for empty slots, `corruptSlots` on a bad checksum and a bad egg, and `readable: false` boxes when the block fails.
- Names, wallpaper index and `currentBox` decode, and a boxed egg's level is computed like any other.
- Types, schema and sync tests are in place, and `.describe()` lists the null fields.
- No ROM bytes are committed.
