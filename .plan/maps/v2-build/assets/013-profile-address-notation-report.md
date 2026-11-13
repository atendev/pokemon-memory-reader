# Decision report: How do profiles write addresses?

Ticket: [How do profiles write addresses?](../tickets/013-profile-address-notation.md), spec §17 item 1. The answer is recorded in the ticket as amendment §17.1.

This was a grilling ticket. The owner answered two rounds of questions in this thread on 2026-11-13. The design sub-agent set the remaining details and checked them against pret symbol files. A haiku auditor reviewed the answer.

## Decisions

### 1. How does a profile write an address?

- Options: bus addresses translated by one map (recommended), domain-prefixed strings such as `"ewram:0x244ec"`, or `{ domain, offset }` objects.
- Choice: bus addresses. Profiles keep the notation that pret and hack `.sym` files print. One per-platform map turns it into a domain and offset.
- Made by: the owner, in grilling round 1.

### 2. How does a GB profile write a banked address?

- Options: pret `bank:address` always (recommended), `bank:address` with the bank optional in unbanked areas, or linear domain offsets.
- Choice: pret `bank:address` always. A bare 16-bit address is a schema error. Bank 0 in `D000`-`DFFF` reads as bank 1.
- Made by: the owner, in grilling round 1.

### 3. How does a pointer value read from memory become a domain and offset, and what happens when it is bad?

- Options: the shared map, with a bad pointer failing only its decoders (recommended); the shared map, with a bad pointer also raising a status `problem`; or per-decoder pointer rules.
- Choice: the shared map, failing only the decoders that use the pointer for that cycle, with no `problem`.
- Made by: the owner, in grilling round 1.

### 4. When does translation happen for static addresses?

- Options: once at profile load (recommended), or at read time.
- Choice: at load. An unmapped address fails the profile load with an error naming the field.
- Made by: the owner, in grilling round 1.

### 5. Which GBA bus ranges does the map accept?

- Options: canonical ranges only (recommended), or fold the hardware mirrors.
- Choice: canonical only. EWRAM `0x02000000`-`0x0203FFFF`, IWRAM `0x03000000`-`0x03007FFF`, ROM `0x08000000`-`0x09FFFFFF`.
- Made by: the owner, in grilling round 2.

### 6. What may a GB profile do with pointer entries?

- Options: no GB pointer entries in v2.0 (recommended), or pointer entries with a target bank field.
- Choice: pointer entries with a target bank. The owner did not take the recommendation.
- Made by: the owner, in grilling round 2.
- Follow-on detail set by the design sub-agent: `bank` is required on GB pointer entries and is a schema error on GBA. The program reads `bank:value` through the GB map.

### 7. Which fields use the notation, and where does the map live?

- Options: every address field with the map in `internal/` (recommended), every field with the map in `server/`, or ROM tables as file offsets with RAM fields as bus addresses.
- Choice: every address field, with the map in `internal/`. The loader, the pointer resolver, the generator and the capture tool all use it.
- Made by: the owner, in grilling round 2.

### 8. Details the design sub-agent set without a question

These follow from the owner's choices or from the hardware. The audit reviewed each one.

- Bank 0 in `4000`-`7FFF` is rejected. The cartridge never maps bank 0 there, and pret prints that area from bank `01`.
- Banks cap at `0xFF` because the notation has two hex digits. A cartridge that needs more banks needs a schema change.
- The loader checks only the map's own rules. An address past the end of the real cartridge fails at read time through the range checks against the game message's domain sizes.
- A pointer value of 0 is null on both platforms and fails before mapping. Without this rule, a zeroed GB pointer with bank 0 would map to the ROM header and the decoder would read garbage. The auditor found this gap in round 1.
- Pointer words are 4 bytes on GBA and 2 bytes on GB, both little-endian.
- How an adapter turns `{ domain, offset }` into its emulator's addressing stays inside the adapter (§3.1). The first draft covered a reverse map for RetroArch. The auditor flagged that the owner had not decided it and that it conflicted with the single-map rule, so it was cut.
- The answer is cited as "amendment §17.1" because the spec has no amendment numbering yet and the item number can't collide with another ticket's.

## Evidence: the map against pret symbols

The design sub-agent wrote the proposed map as a script, downloaded `pokered.sym`, `pokecrystal.sym` and `pokeemerald.sym` from each repo's `symbols` branch, and mapped the state symbols a v2 decoder would read. Every one mapped. It also printed which banks each repo uses in WRAM and SRAM.

```
pokered.sym 00:d163 wPartyCount -> wram+0x1163
pokered.sym 00:d16b wPartyMon1Species -> wram+0x116b
pokered.sym 00:d158 wPlayerName -> wram+0x1158
pokered.sym 00:d31d wNumBagItems -> wram+0x131d
pokered.sym 00:da80 wBoxCount -> wram+0x1a80
pokered.sym 02:a000 sBox1 -> sram+0x4000
pokered.sym 01:b0c0 sCurBoxData -> sram+0x30c0
pokered.sym 00:cfe5 wEnemyMon -> wram+0xfe5
pokered.sym 00:d057 wIsInBattle -> wram+0x1057
pokered.sym 00:fff8 hJoyInput -> hram+0x78
pokered.sym banks seen: A000:[0,1,2,3] C000:[0] D000:[0]
pokecrystal.sym 01:dcd7 wPartyCount -> wram+0x1cd7
pokecrystal.sym 01:dcdf wPartyMon1Species -> wram+0x1cdf
pokecrystal.sym 01:d47d wPlayerName -> wram+0x147d
pokecrystal.sym 01:d892 wNumItems -> wram+0x1892
pokecrystal.sym 02:a000 sBox1 -> sram+0x4000
pokecrystal.sym 01:d206 wEnemyMon -> wram+0x1206
pokecrystal.sym 01:d22d wBattleMode -> wram+0x122d
pokecrystal.sym 01:db72 wCurBox -> wram+0x1b72
pokecrystal.sym 00:ffa8 hJoyDown -> hram+0x28
pokecrystal.sym banks seen: A000:[0,1,2,3,4,5,6,7] C000:[0] D000:[1,2,3,4,5,6,7]
pokeemerald.sym 03005d8c g 00000004 gSaveBlock1Ptr -> iwram+0x5d8c
pokeemerald.sym 03005d90 g 00000004 gSaveBlock2Ptr -> iwram+0x5d90
pokeemerald.sym 03005d94 g 00000004 gPokemonStoragePtr -> iwram+0x5d94
pokeemerald.sym 020244ec g 00000258 gPlayerParty -> ewram+0x244ec
pokeemerald.sym 02024084 g 00000160 gBattleMons -> ewram+0x24084
pokeemerald.sym 02022fec g 00000004 gBattleTypeFlags -> ewram+0x22fec
pokeemerald.sym 0202449c g 00000004 gBattleStruct -> ewram+0x2449c
pokeemerald.sym 083203cc g 00002d10 gSpeciesInfo -> rom+0x3203cc
pokeemerald.sym 083185c8 g 000011b4 gSpeciesNames -> rom+0x3185c8
pokeemerald.sym 0831977c g 00001207 gMoveNames -> rom+0x31977c
OK all mapped
```

A second pass listed the ROM banks each GB symbol file uses. `first` and `last` are the lowest and highest banks that hold a symbol, and `count` is the number of distinct banks that hold one:

```
pokered.sym 4000-7FFF banks: first=01 last=2c count=44
pokered.sym 0000-3FFF banks: 00
pokecrystal.sym 4000-7FFF banks: first=01 last=7e count=121
pokecrystal.sym 0000-3FFF banks: 00
```

What this shows:

- pokered prints all WRAM as bank `00`, `D000` included. That is why bank 0 in `D000`-`DFFF` reads as bank 1.
- pokecrystal prints WRAMX as banks `01` to `07`, which matches the linear `wram` rule in spec §3.2.
- Both repos print `0000`-`3FFF` as bank `00` and start `4000`-`7FFF` at bank `01`. That supports rejecting bank 0 in `4000`-`7FFF`. pokecrystal's highest bank with a symbol is `7e`. Crystal is a 2 MB cartridge, 128 banks, so its top bank is `7F`, under the `0xFF` cap.
- pokecrystal prints SRAM banks up to 7, more than the 32 KB its cartridge has. That is why the loader leaves cartridge size to the read-time range checks.

The symbols branch was read at its tip on 2026-11-13. The script was a throwaway check and is not committed. The `internal/` address map gets its own tests in Core module interfaces, and the generator gets tests in Emerald profile and generator. Those tests replace this check.

## What this affects

[Core module interfaces](../tickets/004-core-module-interfaces.md), [Emerald profile and generator](../tickets/005-emerald-profile-and-generator.md) and [mGBA bridge and adapter](../tickets/007-mgba-bridge-and-adapter.md) already list this ticket in `blocked_by`. No new ticket is needed. Core module interfaces should name the `internal/` address-map module and its pointer resolver. The Emerald generator writes `.sym` addresses as they are.

## Audit

The audit used one haiku auditor.

- Round 1 did not approve. It raised 8 problems: the GB null pointer, load-time versus read-time bank checks, the reverse-map conflict, unverified evidence, the bank ceiling, the rationale for rejecting bank 0 in ROMX, the pointer schema wording, and how to cite the amendment. All 8 were fixed.
- Round 2 did not approve, with one blocking problem: the claim that pret starts ROMX at bank `01` had no evidence in the report. The ROM bank listing above fixes it. Round 2 also asked to name the target games next to the bank cap and to say who reruns the check, and both are fixed. It asked to move the process notes out of this report. They stay, because this report is the decision record the runner requires, and the spec cites the ticket's amendment, not this file.
- Round 3 did not approve, with one problem: the ticket called `7E` Crystal's highest ROM bank, but `7E` is only the highest bank that holds a symbol, and the cartridge's top bank is `7F`. The wording is fixed, and the second-pass columns now have labels.
- Round 4 verdict: APPROVE.

## Skipped gates

The parent wayfinder-master told this child to commit without asking the owner at the step 5 commit gate, and to leave `map.md` alone. The pstack `/why` skill was not run. The rationale for each choice comes from the source tickets in the v2-rebuild map, which were read directly.
