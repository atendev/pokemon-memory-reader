---
type: grilling
blocked_by: [010]
assets: []
---

# ROM hack name tables

## Question

How does a hack's game profile get species, move, item and ability names?

[How ROM hacks extend reference data](./010-hack-reference-data.md) found that names sit in Gen 3-charmap tables at hack-specific addresses. Choose between profiles that declare table addresses and strides so names are read from ROM at attach time, and profiles that ship per-hack JSON name arrays dumped from the owner's ROMs. Settle who produces the data for closed-source hacks, what happens when a bridge can't read cartridge address space, and how unknown IDs show up in the API.

## Answer

A hack's game profile declares where its name tables sit in ROM. The program reads them once after identification and keeps them for the session. No per-hack name data ships.

- **Source.** Profiles declare locations, never names. Addresses are facts under the license decision, so this keeps 005's rule against name tables in profiles. It follows each hack release without a re-dump and doesn't redistribute names that hack authors added.
- **Official games.** Profiles of official games keep the shipped reference data keyed by generation and language from 005. They read nothing from ROM.
- **Profile kind.** Every profile has a required `kind: "official" | "hack"`. It is not inherited through `extends`, so a hack that extends `firered-us-1.0` must state `"hack"` itself. A `kind: "hack"` profile must list all four categories, each as a table or the literal `"vanilla"`, whatever its data format. Zod rejects an omission. `"vanilla"` means the category uses the shipped reference data and reports `"builtin"`. The profile author states it on purpose for a category whose IDs and names the hack left alone, so it is not a fallback for a failed table. An official profile may omit `nameTables`, which means reference data.
- **Format.** `nameTables` has the keys `species`, `moves`, `items` and `abilities`. Each table is `{ base, count, stride, nameOffset?, name }`. `base` uses the 005 address form, so a header pointer is `{ "ptr": "0x08000144", "offset": "0x0" }`. `count` is required. `nameOffset` defaults to 0. `name` is `{ kind: "inline", length }` for fixed-width names inside the entry (CFRU name arrays, or the vanilla-layout item struct with stride `0x2C` and a 14-byte name) or `{ kind: "pointer", maxLength }` when the field at `nameOffset` points to a 0xFF-terminated string (pokeemerald-expansion `gMovesInfo` and `gItemsInfo`).
- **Load timing.** Declared tables load in chunks after identification and before `status.state` becomes `game`, so the state stays `no_game` for about 0.25-1 s per game load. A table that fails to read or validate doesn't hold the state back. Its category is marked unavailable and the state moves to `game`.
- **Validation.** Each table is checked as a whole. Every entry needs a 0xFF terminator within its `length`, or its `maxLength` for pointer names, and only bytes defined in the Gen 3 charmap. Pointer entries must point into cartridge space (`0x08000000`-`0x09FFFFFF`). The share of non-empty entries must meet a named constant, set to 90% until a real hack ROM is checked. A table that fails is discarded whole and logged. Its category gives `name: null` with no fallback to official names, because the hack's IDs no longer match.
- **No ROM access.** If the adapter can't read cartridge space (RetroArch's gpSP core) or the ROM read errors, every category the profile declares as a table gives `name: null`. Party, stats, battle and everything else still decode. The viewer suggests a core that maps ROM, such as RetroArch's mGBA core.
- **Unknown IDs.** `name` becomes `string | null` on species, move, item and ability references, and `id` is always present. An ID beyond a table's `count`, an empty entry in a table that passed validation, a discarded table and missing ROM access all give `null`. The viewer renders `#<id>` itself.
- **Status.** `status.game` gains `names: { species, moves, items, abilities }`. Each value is `"builtin"`, `"rom"` or `"unavailable"`, as a closed enum, or `null` when the generation has no such names, such as `abilities` in Gen 1-2. No `features.names` flag is added.
- **Who finds addresses.** The owner runs a dev-time repo script, `scripts/find-name-tables`, against their own local ROM. It searches for the charmap-encoded first entries of each category, infers base, stride and count, and prints a `nameTables` fragment to review. The ROM never enters the repo. Built-in hack profiles, Radical Red included, are only those the owner wrote this way from their own ROM and checked against fixtures. They follow 007, so a profile is removed if its hack's author objects. Any other hack, closed-source or not, is covered by a user profile. The same script is documented for the people who write those.
- **Expansion hacks.** The `pointer` kind and per-build stride let `nameTables` describe pokeemerald-expansion hacks. Whether v2.0 supports their data format is a separate question, [Expansion hack data format](./023-expansion-hack-data-format.md).

Excluded: per-hack JSON name arrays, offering both ROM reads and JSON, reading official games' names from ROM, placeholder strings such as `"Species #1234"`, dropping the whole reference to `null`, loading names lazily per ID, sending `null` names while tables load, anchor-name checks, unvalidated tables, falling back to official names for categories declared as tables, refusing hack profiles on adapters without ROM access, caching names in the data folder, a runtime ROM scan, and deciding `kind` from pret provenance.

Amended by [Expansion hack data format](./023-expansion-hack-data-format.md): the `pointer` name kind is dropped from v2.0. Only `inline` remains, and the expansion data format may add `pointer` back later.
