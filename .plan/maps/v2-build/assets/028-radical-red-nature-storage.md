# 028 Radical Red nature storage

Conclusion: (1) UNKNOWN, leaning NO separate field. (2) No storage location found. (3) Nothing can be declared without a known location. The decoder keeps the personality % 25 default, the only evidenced source. The unverified status lives in this file, not in the profile schema. If an override is found later, the profile would need its field offset, its bit width and an override flag.

## Claims

- The v4.0 changelog text we could extract has no Nature Mints (grep "mint" returned 0 hits). The extraction may be incomplete, so this is weak evidence of absence. Secondary. https://docs.google.com/document/d/1Iudi1QxBSHOH-jhVrNF-IdaK_ixqbmacvgMmBce8n1c ("Changelog up to v4.0 - Radical Red", read through pdftotext)
- Natures change through a Nature Changer NPC. It sits next to Nurse Joy, costs $500 (later 7500), and only offers some natures. Bashful, Gentle and Lax were added later. Secondary, same changelog (lines "Next to Nurse Joy...", "Added Bashful, Gentle, Lax to Nature Changer", "Nature Changer cost increased from 500 to 7500").
- Changelog bug-fix line "Nature changer lady now says which stats get boosted/decreased". It implies the NPC changes the stat effect. It does not say how. Secondary.
- v4.1 puts a Nature Changer in every Pokemon Center. Secondary. https://www.pokecommunity.com/threads/pok%C3%A9mon-radical-red-v4-1.437688/ (search snippet, not fetched in full)
- Whether v4.1 added mints is unverified. Only a search snippet covered it, and no hit mentioned mints.
- Whether the Nature Changer rewrites personality or sets a hidden field is unverified. No public doc covers it.
- CFRU derives nature from personality only and rerolls personality (`GiveMonNatureAndAbility` loops on `Random32()` until `GetNatureFromPersonality` matches). A search for `hiddenNature` found nothing, and "mint" matched only unrelated files. Primary, read in the earlier CFRU research: [016-pokemon-schema-cfru.md](./016-pokemon-schema-cfru.md) section 4. Absence from a code search is not proof of absence. Primary for CFRU only. Radical Red source is closed. https://github.com/Skeli789/Complete-Fire-Red-Upgrade
- Bulbapedia, general background only and not Radical Red evidence: Gen III and IV derive nature from PID. Not quoted here; unverified for this ticket. https://bulbapedia.bulbagarden.net/wiki/Nature
- PKHeX has a Gen 3 hack analog: not found. Unverified. A PKEdit forum thread says the Radical Red save layout may match Unbound. Speculation. https://projectpokemon.org/home/forums/topic/66685-pkedit-cross-platform-pok%C3%A9mon-save-file-editor/

## Gaps
- No ROM, save or disassembly check was done (out of scope).
- The v4.1 changelog and the in-game item list were not read.
- The PokeCommunity thread pages were not fetched.
