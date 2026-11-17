# Species-info layout and the CFRU signature: amendment for spec §5.4, §5.5, §5.6 and §12.9

Resolves [How is the species-info layout confirmed, and does the signature still catch CFRU builds without DPE?](../tickets/023-cfru-species-layout-and-signature.md), spec §17 item 11. Facts behind it: [023 facts](./023-cfru-species-layout-and-signature-facts.md) and the v2-rebuild [hack species data research](../../v2-rebuild/assets/024-hack-species-data.md).

Decided in auto mode on 2026-11-17 (UTC). The main thread asked each question with a recommendation, and a grilling subagent answered. CFRU sources are pinned to Skeli789/Complete-Fire-Red-Upgrade `b637a27898b14e25dd24d0f69a3e302f0069deb8`.

## Facts

- **Vanilla stride.** pret's `pokeemerald.sym`, which the generator already parses with symbol sizes (`scripts/generate-profiles/sym.ts`), gives `gSpeciesInfo` a size of `0x2D10`. That is 412 entries of `0x1C`, and 412 is `NUM_SPECIES`. pret's `make compare` checks the build against the retail SHA-1 in `rom.sha1`, the file the generator already checks the profile's hash against (ticket 005), so a matching build's linker output states the retail layout without reading ROM bytes. The struct's fields end at `0x1A`, so the last 2 bytes of each entry are padding. That agbcc rounds the struct to 4 bytes is the likely reason (inferred), but the sym size is what confirms it.
- **CFRU stride.** CFRU's `struct BaseStats` keeps every vanilla offset and adds `u8 hiddenAbility` at `0x1A`. It is built with modern arm-none-eabi-gcc, where the u16 members give 2-byte alignment, so the size is `0x1C` by the ABI. No CFRU symbol file with sizes is published, and Radical Red's source is closed, so nothing outside a ROM states it.
- **CFRU header words without DPE.** CFRU's own `repointall` lists `gBattleMoves` (line 3) and `gAbilityNames` (line 6). `scripts/insert.py` applies both unconditionally, rewriting every ROM word equal to the vanilla pointer, so header words `0x080001CC` (moves) and `0x080001C0` (ability names) move. CFRU itself never rewrites `0x08000144`, `0x080001BC` or `0x080001C8`. DPE's own `repointall` (line 6, `gBaseStats 080001BC`) moves `0x080001BC`, per the v2-rebuild [hack species data research](../../v2-rebuild/assets/024-hack-species-data.md), section 6.
- **Scope of the CFRU facts.** They come from the pinned commit only. CFRU master and closed forks such as Radical Red weren't read, so decision 7 checks each shipped hack's ROM.
- The official Gen 3 signature is the GF header words for species info (`0x1BC`), items (`0x1C8`) and moves (`0x1CC`).

## Decisions

1. **The generator confirms the vanilla stride.** For every pret repo it reads, `generate:profiles` checks that the species-info symbol's size equals the species count times `0x1C`. The species count is the one the reference generator uses for that repo's data format (412 for pokeemerald, matching `gen3-en.json`), and fails the run otherwise. A CI test runs the check on the committed sym excerpt. This covers revisions the owner doesn't own.
   - **Excluded:** a `test:local` check against the owner's retail ROM. It adds nothing the sym doesn't state, and it covers only the owner's revisions.
2. **The owner's ROM confirms the CFRU stride.** The ABI reasoning is the expectation, not the confirmation.
   - A `test:local` check on the owner's CFRU ROM reads each built-in hack profile's `info` table. The table must pass the full §5.6 validation at stride `0x1C` and fail it at `0x1A` and `0x1E`.
   - `scripts/find-rom-tables` measures the stride as the distance from Bulbasaur's entry to the next entry that matches Ivysaur's vanilla base stats, and prints it. It refuses to print a CFRU `speciesData` fragment when the measured stride isn't `0x1C`, and reports the stride as unmeasured when the hack edited Ivysaur.
   - **Excluded:** accepting the ABI reasoning alone.
3. **The confirmation gates hack species-table reading only.** The vanilla check gates `info` tables in Gen 3 hack profiles. The CFRU check gates shipping any built-in CFRU profile that declares an `info` table. Neither touches a data format's `supported` flag.
   - Official profiles take species data from reference data and never read `info` from ROM, so the stride can't affect Gen 3 `supported`.
   - ROM-derived fields never go on a golden's `verified` list (§12.2), so the tier 1 support gate (§12.8) can't see the `info` table. Tying the check to `supported` would gate the wrong thing.
   - **Excluded:** gating the Gen 3 or CFRU `supported` flag.
4. **Runtime validation stays as §5.6 writes it.** User hack profiles nobody checked rely on it. A 2-byte drift should put the `growthRate` and ability reads on other fields within a few entries, so whole-table validation is expected to reject a wrong stride. That is an expectation, not yet shown: a synthetic test reads a valid table at `0x1A` and `0x1E` and must see it fail before the hack species decoder ships. If it passes, the build ticket adds a stricter check rather than shipping. The stride stays in data-format code, and a hack with another stride needs a new data format, not a profile field.
   - **Excluded:** an optional `stride` field on `info`, and a rule that entry 0 is all zero, which could reject a legitimate hack.
5. **The vanilla signature still guards CFRU builds without DPE, through the moves word.** At the pinned commit, CFRU repoints `gBattleMoves` unconditionally, so the unchanged species, items and moves signature fails on any build from it, with or without DPE. DPE builds also fail `0x1BC`. The signature shape doesn't change.
   - Other CFRU commits and closed forks weren't read, so this is the expectation for them, and decision 7 checks it on each shipped hack's ROM. A user hack nobody checked keeps the §5.4 known gap if its build left `0x1CC` alone.
   - **Excluded:** adding the ability-names word `0x1C0` to FireRed/LeafGreen signatures, or to every GF-header profile. It adds generator work and ledger re-checks without covering any build the moves word misses.
6. **The CFRU gate runs through the signature evidence ledger.** `test:local --record` writes one row per built-in hack profile and ROM SHA-1, as a new check kind beside the signature rows in the ledger files from tickets 037 and 055. `release-gate.test.ts` fails when a shipped built-in hack profile declares a `speciesData.info` table and has no passing row. A failed check writes a failure row that blocks the profile, as ticket 055 does for signatures.
   - **Excluded:** a manual line in `RELEASING.md`, and a `provenance.speciesDataEvidence` field on the profile.
7. **The same row checks the base signature.** The hack check also asserts that the base official profile's signature (FireRed US 1.0 for CFRU) fails on the hack ROM. The row records the base profile ID and passes only when both the stride check and this check pass. On an emulator that gives no hash, a base signature that passed would let the header path load FireRed's profile on the hack.
   - **Excluded:** an unrecorded report line, and no check at all.

## Spec changes

Spec sections cite this amendment. `spec.md` isn't edited in this ticket.

- **§5.4, vanilla signature.** Replace the bullet that leaves CFRU open with: CFRU at the pinned commit repoints `gBattleMoves` unconditionally, so the vanilla signature fails on its builds through `0x1CC`, and DPE builds also fail `0x1BC`. Other CFRU commits and forks are expected to behave the same. A `test:local` hack check confirms it for each shipped hack (decision 7).
- **§5.5, finding addresses.** `find-rom-tables` measures and prints the species-info stride and refuses a CFRU fragment that isn't `0x1C` (decision 2).
- **§5.6, layout.** Replace "must be confirmed before either decoder ships" with decisions 1 to 4: the generator confirms the vanilla stride from pret symbol sizes, the owner's ROM confirms the CFRU stride through the ledger gate, and validation catches a wrong stride in user profiles.
- **§12.9.** `test:local` also runs the hack check of decisions 2 and 7 for each built-in hack profile, and `--record` writes its row.
- **§17 item 11.** Resolved here.

## What gets built when

- Now: [Check the species-info stride in the profile generator](../tickets/059-generator-species-info-stride-check.md), decision 1. It covers Emerald's sym today and each pret repo as its profile lands.
- With the CFRU and hack profiles work: the `test:local` hack check, its ledger row and release-gate rule (decisions 2, 6 and 7), the `find-rom-tables` stride measure (decision 2), and the wrong-stride synthetic test (decision 4). They need the hack profile schema and the CFRU decoder, which don't exist yet.
