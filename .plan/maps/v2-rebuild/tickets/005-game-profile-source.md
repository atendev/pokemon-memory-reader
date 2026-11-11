---
type: grilling
blocked_by: [002]
assets: []
---

# Game profile source and format

## Question

Where do game profiles come from, and what format are they stored in?

Decide what gets generated from decomp symbols and what gets written by hand, the file format, whether profiles ship inside the app or load from files users can add (for ROM hacks), and how a profile describes struct layouts so decoders can share code across games of the same format.

## Answer

A game profile is a JSON file for one ROM revision. One Zod schema checks every profile. A dev-time generator writes the addresses from pret symbols, and people write the rest by hand. The app embeds the built-in profiles and also loads profiles from a user folder.

- **Generated vs hand-written.** A generator script reads the pret `symbols` branches and extracts a hand-kept list of symbols per generation, such as `gPlayerParty`, `gSaveBlock1Ptr` and `wPartyMons`. Struct layouts, per-game constants, and every CFRU hack profile are hand-written.
- **When it runs.** The generator runs at dev time only. Its output is committed and reviewed as a diff, and the app never fetches symbols. Each generated profile records its provenance: pret repo, commit SHA, and symbol file. The license ticket uses this.
- **Format.** JSON files checked by one Zod schema, which is also exported as JSON Schema so editors autocomplete hand-written profiles. Addresses are hex strings such as `"0x02024284"`. Built-in and user profiles use the same format and the same loader.
- **Pointer addresses.** An address entry is either `"0x..."` or `{ "ptr": "0x...", "offset": "0x..." }`. For a pointer entry, the app reads the pointer and then reads at the target plus the offset. Emerald and FireRed save blocks use pointer entries and Ruby/Sapphire use static ones, so one Gen 3 decoder serves all of them and no decoder hard-codes which games use pointers.
- **Loading.** Built-in profiles are embedded in the executable at build. The app also reads a user profiles folder, and a user profile with the same ID replaces the built-in one. The folder's location belongs to the config file decision.
- **Granularity.** One profile per ROM revision. A profile may `extends` one parent and override individual fields, so Blue extends Red and a hack profile can extend `firered-us-1.0`.
- **IDs.** Lowercase `<game>-<region>-<revision>`, as in `firered-us-1.0`, `ruby-de-1.1` or `crystal-us-1.1`. Hacks use their own slug, such as `radical-red-4.1`. Whether the API exposes the ID is left to the API contract ticket.
- **Struct layouts.** Layouts live in decoder code as typed offset tables, one per data format (Gen 1, Gen 2, Gen 3, CFRU). A profile names its data format and supplies only addresses and constants. A hack that changes a struct layout needs a code change and a release.
- **Reference data.** Species, move and item names and charmaps don't go in profiles. They're shared reference data keyed by generation and language, and a profile states its `language`.
- **Identity.** The schema reserves an `identify` block with optional `sha1` (a list) and `gameCode`. The game identification decision can add fields to it.

Layouts stay in code because typed tables give strong types, fast tests and simpler decoders, which matter when agents do most of the building. The hacks that really change layouts are mostly CFRU, and CFRU needs its own decoder anyway. Data-driven layouts can be added later without breaking this design.

Excluded: hand-writing all addresses, fetching symbols at runtime, TypeScript-module profiles, YAML and TOML, layouts as data that profiles override field by field, and putting name tables inside profiles.
