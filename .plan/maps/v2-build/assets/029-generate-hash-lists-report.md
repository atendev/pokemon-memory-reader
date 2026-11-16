# Generate hash lists from pret and No-Intro: decision report

Ticket: [Generate hash lists from pret and No-Intro](../tickets/029-generate-hash-lists.md). Built on branch `t3/generate-hash-lists-pret-no-intro`. Audit: APPROVE in round 1 (haiku auditor).

## Decisions

1. **Where the hash lists come from.**
   - Question: how does `generate:profiles` get `identify.sha1` and `identify.crc32`?
   - Options: keep them hand-written and verify them, or derive both lists.
   - Choice: derive both. `identify.sha1` is every SHA-1 in the pinned pret file, in file order. `identify.crc32` is the CRC32 of the No-Intro entry with the same SHA-1, in the same order. The definition no longer holds either list.
   - Made by: main thread, following [Where does reference data come from?](../tickets/019-reference-data-source.md).
   - Audit: approved.

2. **Which No-Intro source.**
   - Question: where does the generator read No-Intro?
   - Choice: the DAT in `libretro/libretro-database` at the commit named in the research findings (`5e01cef0d4d264e05f8021d89e6b4a193fd50aa7`), file `metadat/no-intro/Nintendo - Game Boy Advance.dat`. The definition carries this as a new `noIntro` field. `main.ts` fetches and parses each pinned file once and shares it across profiles on the same platform.
   - Match by SHA-1 only, never by entry name. The research findings show the GBC DAT holds an unlicensed "Pokemon - Sapphire Version" entry, so a name match could pick the wrong game.
   - Made by: main thread. Audit: approved.

3. **Failure behavior.**
   - A SHA-1 with no No-Intro entry throws, and the message names the SHA-1, the pret file and the DAT file, and says to move the pinned DAT commit forward or take the definition out. Two entries with the same SHA-1 and different CRC32 values also throw.
   - The auditor noted that decision 019 says a disagreement "leaves that revision without hashes", and this code fails the whole run instead. The ticket's acceptance criterion asks for a failure, so the code follows the ticket. No path leaves a revision without hashes. This matters when a later ticket adds Sapphire German 1.0, where pret and No-Intro disagree. That ticket has to either hold the definition back or add a hold-back path. The auditor also pointed out that the first draft of the message mentioned "hold the revision back", a mechanism that does not exist. I reworded the message to name what an operator can do.
   - Made by: main thread, with the auditor's note applied.

4. **Tests use checked-in excerpts.**
   - `fixtures/pokeemerald.rom.sha1` is pret's file as read at the pinned commit. `fixtures/no-intro-gba.excerpt.dat` is the DAT header plus the Emerald block and one neighbour, copied from the pinned DAT. No ROM bytes are committed and no test touches the network.
   - Tests cover: the derived lists equal the Emerald values, the profile and index still match the committed files, pret line parsing, DAT parsing with lowercasing, a missing SHA-1 failing with its message, and conflicting CRC32 values failing.
   - Audit: approved. The auditor noted that the missing-SHA-1 failure is tested at the `resolveHashes` level, and `main.ts` only passes the error through.

5. **Provenance.** I left the profile's `provenance` block alone, so the committed JSON and the profile schema are unchanged. The hash sources are pinned in `definitions.ts`. Recording them in the profile would be a schema change and belongs to a ticket of its own.

## Evidence

- `bun run generate:profiles` ran against the network and left `server/src/profile/builtin/` unchanged. The hash lists are the same values as before, so a second run gives no diff.
- `bun test scripts` passes (28 tests). Typecheck and `biome ci` pass.
- The full `bun test` has one failure, `the Lua core runs under Lua 5.3 or 5.4`. This machine has Lua 5.5, and CI uses 5.4. The failure does not involve this change.

## Skipped

- I did not rename the thread. The runner step is optional and no thread tool was needed for the work.
