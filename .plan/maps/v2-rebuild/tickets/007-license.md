---
type: grilling
blocked_by: [002]
assets: []
---

# License

## Question

What license does v2 ship under?

The v1 license combines GPL-3.0 with Creative Commons NonCommercial terms, which conflict because GPL-3.0 forbids extra restrictions. Pick a license that matches the owner's intent, check it against the licenses of bundled code and of data derived from the decomps, and decide whether RAM dumps used as test fixtures can be committed.

## Answer

v2 ships under **GPL-3.0-or-later**, and the NonCommercial terms are dropped. The owner is the sole author, so relicensing needs no one else's consent.

- **Why GPL.** It stops closed forks and keeps any redistributed copy open. A NonCommercial license (PolyForm Noncommercial, CC BY-NC) was rejected because monetized streams, the main use, would fall in a gray area. Overlays that only call the HTTP API are separate programs and can use any license.
- **Importable packages.** Any workspace package meant to be imported by outside code (API types, Zod schemas, an SSE client) ships under **MIT** with its own `LICENSE`. Whether such a package exists is still open.
- **License markers.** Each package has one SPDX ID in the `license` field of `package.json`. The repo root holds `LICENSE` and `NOTICE`. Source files get no per-file headers.
- **pret-derived data.** Addresses and struct field offsets count as facts. Generated profiles keep their provenance block (repo, commit SHA, symbol file), and `NOTICE` credits pret. No pret C or assembly source is copied into the repo.
- **CFRU and Radical Red profiles.** These are embedded like any other built-in profile on the same "addresses are facts" reasoning, and `NOTICE` credits CFRU. If a hack author objects, that profile is removed.
- **Nintendo content.** The repo and the executable bundle names and numeric reference data (species, moves, items, base stats) but no sprites, artwork or audio. The README carries a notice that the project is not affiliated with Nintendo, Game Freak or The Pokémon Company.
- **Test fixtures.** Only trimmed RAM slices are committed: the address ranges a decoder reads, tagged with profile ID and address. Savestates and full RAM dumps stay local and gitignored. Synthetic-only fixtures were rejected because real slices catch layout mistakes.
- **v1.** The `v1-lua` tag stays untouched. The v2 README states that v1 was released under the GPL-3.0 text in its `LICENSE` file.

Excluded: MIT or Apache for the whole app (allows closed forks), NonCommercial or source-available licenses, committing savestates or full dumps, and bundling Nintendo art.
