---
type: research
blocked_by: []
assets: [../assets/028-radical-red-nature-storage.md, ../assets/028-radical-red-nature-storage-report.md]
claimed_by: wayfinder-master v2-build-master-1794843940
claimed_at: 2026-11-16T16:05:32Z
---

# Does Radical Red store a nature apart from personality % 25?

## Question

[What is the full Pokémon schema?](./016-pokemon-schema.md) decodes Gen 3 `nature` as personality % 25. Some CFRU hacks, Radical Red among them, may let the player change a Pokémon's nature (a nature mint or a similar item) without rerolling its personality. Find out whether Radical Red, or CFRU in general, stores a nature separately from the personality value, and where. If it does, say what the hack profile has to declare so the decoder reads the stored nature instead.

Work from public hack documentation and source. Don't commit ROM bytes.

## Answer

Unknown. No public source shows where, or whether, Radical Red stores a nature apart from personality % 25, so no storage location can be named. Public evidence leans toward no separate field. [The findings](../assets/028-radical-red-nature-storage.md) hold the sources.

- In the CFRU code read, nature comes from personality and the code rerolls personality to set one. The earlier CFRU research ([section 4](../assets/016-pokemon-schema-cfru.md)) read `GiveMonNatureAndAbility` and found no override field and no mint code in a name search (`hiddenNature`, `mint`). A name search does not prove absence. Radical Red's source is closed.
- The v4.0 changelog text we could extract lists no mints, though the extraction may be incomplete. A Nature Changer NPC changes natures instead. No public document says whether it rewrites the personality or sets a hidden field.
- The v4.1 changelog and the in-game item list were not read, and nothing was checked against a ROM or save.
- The ticket asks what the profile must declare for a stored nature. With no known location, nothing can be declared. Until one is found, the decoder keeps reading `nature` as personality % 25 (the only source with evidence behind it), and the profile gains no field. If a save test later finds an override, the profile would need its offset, its bit width and an override flag.
- A ROM or save check would settle it. It is out of scope here (no ROM bytes), so the report returns it as a surfaced ticket for the master to add to the map.
