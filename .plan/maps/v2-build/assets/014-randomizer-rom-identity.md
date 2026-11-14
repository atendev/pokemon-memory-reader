# Randomizer ROM identity (UPR ZX)

Research for ticket 014. Checked on 2026-11-13. Primary sources only. UPR ZX is read at `master` HEAD `7f00eb866ed35c8fe3963f078b6a2e0979dc2b8c` (2024-11-23, the last push to the repo). Claims marked **unverified** were not confirmed in a primary source.

## Sub-question

How does a randomized Pokemon ROM's identity differ from its base ROM, as produced by the Universal Pokemon Randomizer ZX (UPR ZX, the randomizer Ironmon players use)?

- Gen 3 GBA: does UPR ZX change the cartridge header (title 0xA0, game code 0xAC, maker code, software version 0xBC, complement check 0xBD)? Does it move the species, item or move tables, or rewrite the Game Freak ROM header words that point to them (near 0x100, e.g. the species-data word at 0x080001BC in FireRed)?
- Gen 1-2 GB: does UPR ZX recompute the 16-bit global checksum at 0x14E-0x14F or the header checksum at 0x14D, or change the title at 0x134?
- Ironmon-Tracker quickload (batch) workflow: does each new seed get a new file name, or overwrite one file?

## Findings

Base URL for UPR ZX links: `https://github.com/Ajarmar/universal-pokemon-randomizer-zx/blob/7f00eb866ed35c8fe3963f078b6a2e0979dc2b8c/src/com/dabomstew/pkrandom/` (shortened to `UPR/` below). Whole-repo greps ran on the tarball of that commit.

### Gen 1-2 (GB): header untouched, no checksum recompute

- The save path writes the in-memory ROM byte array to disk unchanged. No checksum step, no header step. `UPR/romhandlers/AbstractGBRomHandler.java` L71-84 (`saveRomFile`). The only caller for a GB file is `UPR/Randomizer.java` L680.
- `savingRom()` for Gen 1 and Gen 2 only calls `savePokemonStats(); saveMoves();`. `UPR/romhandlers/Gen1RomHandler.java` L403-406, `Gen2RomHandler.java` L361-364.
- The GB header offsets are defined in `UPR/constants/GBConstants.java` L39-40: `jpFlagOffset=0x14A`, `versionOffset=0x14C`, `crcOffset=0x14E`, `romSigOffset=0x134`, `isGBCOffset=0x143`, `romCodeOffset=0x13F`. Every use is a read: `checkRomEntry` (`Gen1RomHandler.java` L380-399, `Gen2RomHandler.java` L339-358) and `romSig`/`romCode` (`AbstractGBCRomHandler.java` L193-224). `isGBCOffset` has no use in the Gen 1-2 handlers.
- A grep of the whole source tree for `0x14D`, `0x14E`, `0x14F`, `0x134`, `checksum` and `complement` finds no write to those header bytes. So the title at 0x134 and the header checksum at 0x14D keep the base ROM values. The 16-bit global checksum at 0x14E-0x14F is not recomputed, so it keeps the base ROM value and no longer matches the file (**inferred** from the absence of any write; I did not run the randomizer).
- The handlers never replace or resize the ROM buffer after load (only `this.rom = loaded`, `AbstractGBRomHandler.java` L57). File size is unchanged.
- The only seed fingerprint written into a ROM is `writeCheckValueToROM` (`Randomizer.java` L674). The default is a no-op (`UPR/romhandlers/AbstractRomHandler.java` L7491-7494). Only `Gen2RomHandler.java` L2992-2999 overrides it (4 bytes at `CheckValueOffset`), and `https://github.com/Ajarmar/universal-pokemon-randomizer-zx/blob/7f00eb866ed35c8fe3963f078b6a2e0979dc2b8c/src/com/dabomstew/pkrandom/config/gen2_offsets.ini` L319 defines `CheckValueOffset=0x3E95` only in the `[Crystal SpeedChoice v3]` section (L268). Gen 1, other Gen 2 ROMs and Gen 3 get no fingerprint.

### Gen 3 (GBA): header untouched except one translation ROM, tables edited in place

- Header offsets: `UPR/constants/Gen3Constants.java` L47-48: `romNameOffset=0xA0`, `romCodeOffset=0xAC`, `romVersionOffset=0xBC`, `headerChecksumOffset=0xBD`. The handler reads them to detect the ROM (`Gen3RomHandler.java` L400, L410, L1437-1465). The maker code at 0xB0 has no constant.
- One exception writes the header: when the title at 0xA0 is `YJencrypted` (an unofficial Emerald translation), `detectRomInner` sets 0xAC-0xAF to `BPET` and 0xBD to `0x66` (`Gen3RomHandler.java` L373-386). `loadRom` passes the same buffer to `detectRom` and then keeps it as the ROM (`AbstractGBRomHandler.java` L50-63), so the patched header reaches the saved file. Every other Gen 3 ROM keeps a header bit-identical to the base (title, game code, version, complement byte).
- `savingRom()` only calls `savePokemonStats(); saveMoves();` (`Gen3RomHandler.java` L701-704). Species names and base stats are written in place at `PokemonNames + i*nameLen` and `PokemonStats + i*baseStatsEntrySize` (L815-826). Move data is written in place at `MoveData + i*0xC` (L1243-1260). Those tables are not moved.
- The Game Freak header pointer words (`Gen3Constants.java` L75-77: names 0x144, move names 0x148, front sprites 0x128, palettes 0x130, species data 0x1BC, abilities 0x1C0, item data 0x1C8, move data 0x1CC) are used only as `readPointer(...)` arguments (`Gen3RomHandler.java` L438-445). No `writePointer` call site uses them, so the species-data word at 0x1BC (0x080001BC) is not rewritten.
- Repoints happen, but only to data that table entries point at, and only into free space inside the existing ROM: trainer party data when a party grows (L1984-1991), move learnsets when longer (L2170-2178), TM item descriptions (L2649-2657), TM and tutor move text (L2681-2698, L2798-2815). Free space comes from `RomFunctions.freeSpaceFinder` (`UPR/RomFunctions.java` L170-196), which searches existing bytes. The handler throws "ROM is full" if none is found and never resizes the ROM (`Gen3RomHandler.java` L1987-1989, L2175-2177).
- `printRomDiagnostics` prints the original ROM's CRC32 to the log file only (`AbstractGBRomHandler.java` L114-120). It is not written into the ROM.

### Consequence for keying

- Header-based identity (GBA game code and version, GB title and version bytes) is the same for a base ROM and every randomized ROM of it. Any key built only from those fields cannot tell seeds apart.
- Whole-file hashes (`crc32` and similar) change with every seed and settings combination, because data bytes change while the file size stays the same.

### Not researched

- Ironmon-Tracker quickload file naming. The subagent stopped at a rate limit first. The decision doesn't need it, because on an emulator with no hash a seed passes the header and the signature and loads without a pick.
