---
type: grilling
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794555906
claimed_at: 2026-11-13T08:17:58Z
---

# How do profiles write addresses?

## Question

Spec §17 item 1. Profile tickets write GBA bus addresses, while the bridge wire protocol and the fixtures use domain names plus offsets. Decide how a profile writes an address, how it writes a GB banked address (`bank:address`), and how the program maps a pointer read from memory (a bus address) to a domain and offset.

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

Profiles keep each platform's native notation. One address map in `internal/` turns it into a domain and offset. The owner chose this in a grilling interview on 2026-11-13. Cite it as **amendment §17.1**. It amends spec §3.2 and the addresses row of §5.1.

### Amendment §17.1: profile addresses

1. **Notation.** Every address field in a profile uses bus notation: game-state addresses, the `ptr` of pointer entries, `identify.signature[].address`, `nameTables`, `speciesData` and the trainer tables.
   - GBA: a hex string of the bus address, such as `"0x020244EC"`. Case is free.
   - GB and GBC: pret's `bank:address`, always two hex digits, a colon and four hex digits, such as `"01:dcd7"`. A bare 16-bit address is a schema error. Two digits cap the bank at `0xFF`. Red, Blue, Yellow, Gold, Silver and Crystal stay below that (Crystal is a 2 MB cartridge, so its top ROM bank is `7F`), and a cartridge that needs more banks needs a schema change.
2. **The address map.** One pure module in `internal/` owns a fixed map per platform. The profile loader, the read loop's pointer resolver, the generator and the fixture capture tool all use it. Nothing else turns a profile address or a pointer value read from memory into a domain offset.
3. **GBA map.** Only canonical ranges are accepted. Mirrors are unmapped.

   | Bus range | Domain | Offset |
   |---|---|---|
   | `0x02000000`-`0x0203FFFF` | `ewram` | bus − `0x02000000` |
   | `0x03000000`-`0x03007FFF` | `iwram` | bus − `0x03000000` |
   | `0x08000000`-`0x09FFFFFF` | `rom` | bus − `0x08000000` |

4. **GB map.** For `bank:address`:

   | Address | Bank | Domain | Offset |
   |---|---|---|---|
   | `0000`-`3FFF` | must be 0 | `rom` | address |
   | `4000`-`7FFF` | 1 to `FF` | `rom` | bank × `0x4000` + address − `0x4000` |
   | `A000`-`BFFF` | 0 to `FF` | `sram` | bank × `0x2000` + address − `0xA000` |
   | `C000`-`CFFF` | must be 0 | `wram` | address − `0xC000` |
   | `D000`-`DFFF` | 0 to 7, where 0 means 1 | `wram` | bank × `0x1000` + address − `0xD000` |
   | `FF80`-`FFFE` | must be 0 | `hram` | address − `0xFF80` |

   - Bank 0 in `D000`-`DFFF` reads as bank 1. pret's DMG builds (pokered) print all WRAM as `00:dxxx` because DMG WRAM is one 8 KB block. pret's CGB builds (pokecrystal) print `01` to `07`.
   - Bank 0 in `4000`-`7FFF` is rejected. The cartridge never maps bank 0 there, and pokered and pokecrystal print that area from bank `01` (see the report).
   - Echo RAM, VRAM, OAM and I/O are unmapped.
5. **At load.** The loader validates and translates every address once. A malformed string, an unmapped address or a bank that breaks the table's rules fails the profile load with an error naming the field and the value. The loader can't know the cartridge's real ROM or RAM size. An address inside the table but past the end of the loaded cartridge, such as SRAM bank 5 on a 32 KB cartridge, fails at read time through the range checks against the game message's domain sizes (§3.2, §4.4). After loading, decoders, declared reads, fixtures and the capture tool see only `{ domain, offset }`. Bus notation never reaches the wire, as Bridge wire protocol already rules.
6. **Pointer entries.** `{ "ptr": <address>, "offset": "0x..." }` on GBA. `{ "ptr": <address>, "offset": "0x...", "bank": "bb" }` on GB and GBC, where `bank` is required. `bank` on a GBA profile is a schema error.
   - The program reads the pointer word at `ptr`. On GBA it is 4 bytes and on GB 2 bytes, both little-endian.
   - On GBA the value is a full bus address. On GB the pair `bank:value` is the address, with `bank` naming the target's bank.
   - The program maps that address through the same map, then adds `offset` to the domain offset.
   - No v2.0 decoder is planned to need a GB pointer entry, but the schema allows one.
7. **Null and bad pointer values.** A pointer value of 0 is null on both platforms. It fails without being mapped, because on GB `00:0000` would otherwise map to the ROM header. A null value or one the map rejects, such as a zeroed or half-written word during boot, fails the decoders that use it for that cycle, as a failed range check does (§4.4). It raises no `problem` and doesn't stop the read loop. The next cycle reads the pointer again (§8.5).

Not covered here: how an adapter turns `{ domain, offset }` into its emulator's own addressing. That stays inside each adapter (§3.1). The RetroArch adapter's GBA and GB core layouts (§3.4) belong to the RetroArch tickets.

**Why.** pret `.sym` files, hack `.sym` files and hack docs all print bus addresses. Keeping that notation lets the generator copy addresses as they are and lets people paste hand-written CFRU addresses without converting them. Translating at load means decoders and fixtures keep the domain-plus-offset contract from Decoder test fixtures and Bridge wire protocol, and a malformed or unmapped address fails at startup, not mid-read. The [decision report](../assets/013-profile-address-notation-report.md) records a check of the map against the pret symbol files: every state symbol tried in pokered, pokecrystal and pokeemerald maps, and the WRAM bank numbers each repo prints.

**Excluded:** domain-prefixed strings (`"ewram:0x244ec"`) and `{ domain, offset }` objects in profiles, ROM tables written as file offsets, folding GBA mirrors, bare 16-bit GB addresses, per-decoder pointer rules, and raising a `problem` for a bad pointer.

**Checks.** The audit approved in round 4. CI run 43393858299 passed on df81768.
