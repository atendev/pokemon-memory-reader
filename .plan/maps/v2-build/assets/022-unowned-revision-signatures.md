# Signatures on unowned revisions: amendment for spec §17 item 10

Resolves [What happens to signatures for revisions the owner doesn't own?](../tickets/022-unowned-revision-signatures.md). Facts behind it: [022 facts](./022-unowned-revision-signatures-facts.md).

These were decided in auto mode on 2026-11-16 (UTC). The owner handed every question to the runner's Auto mode loop. The main thread asked each question with a recommendation, and a grilling subagent answered. When the spec text is next updated, spec §1 (Games), §5.1 (`provenance` row), §5.3, §5.4 and §12.9 will cite this amendment for §17 item 10. This ticket doesn't edit the spec. Each numbered item below replaces or extends the text it names.

## Why a pret build stands in for a ROM

pret builds are byte-identical to retail when `make compare` passes. If pret's SHA-1 for a build equals the No-Intro SHA-1 for the retail revision, the pret symbols describe the retail ROM's bytes. The generator then reads each signature word from those symbols. The one part symbols can't prove is the generator's own mapping from a GF ROM header field to a symbol, such as the Emerald header word at `0x1BC` to `gSpeciesInfo` ([005 report](./005-emerald-profile-and-generator-report.md)). Every revision built from one pret repo shares that mapping. So one owned ROM per repo confirms the mapping for all of that repo's revisions.

## Amendment

1. **Scope.** This covers official Gen 3 profiles: Emerald (pokeemerald), FireRed and LeafGreen (pokefirered), and Ruby and Sapphire (pokeruby) once their signature words exist (item 9). Gen 1-2 profiles declare no signature, and `status.game.signature` stays `null` for them, as §5.4 already says ("`null` means the profile declares no signature, as in Gen 1-2"). A Gen 3 revision with no pret build is outside v2.0, because §1 limits games to "every region and revision the pret symbol files cover". Every built-in official Gen 3 profile therefore has a pret build and a pret SHA-1. Hack profile signatures stay under §5.4 and [the CFRU signature ticket](../tickets/023-cfru-species-layout-and-signature.md).

2. **Evidence levels.** Each official Gen 3 profile that declares signature words has one evidence level.
   - `owner`: the owner's `test:local` run confirmed the signature on a retail ROM whose SHA-1 is the revision's No-Intro SHA-1. When the chain holds, that is the same value as the pret SHA-1 in `identify.sha1`. This level applies whatever the chain status.
   - `chain`: the profile's pret SHA-1 equals a No-Intro SHA-1, and another revision from the same pret repo has level `owner`. That owned revision confirms the field mapping.
   - `unconfirmed`: the profile's pret SHA-1 equals a No-Intro SHA-1, but no revision from its pret repo has been checked on a real ROM.
   - A revision whose pret SHA-1 matches no No-Intro SHA-1 has a broken chain. It can't be `chain` or `unconfirmed`. Until it reaches `owner`, it follows item 4.

3. **Unowned revisions ship.** An official Gen 3 revision the owner doesn't own ships in v2.0 with its generated signature, at level `chain` or `unconfirmed`. A wrong signature costs little. On an exact hash match, a `mismatch` only logs a profile error (§5.4). On an emulator that gives no hash, it sends the ROM to `unidentified` until a manual pick. Holding these revisions back would cost users whole games. Shipping them with no signature would drop the only hack guard on header matches.
   - **Excluded:** holding unowned revisions back, and shipping them with no signature.

4. **Broken chains are held back.** An unowned revision whose chain is broken doesn't ship as a built-in profile. Today that is only Sapphire German 1.0 (pret `fa0bd1ab…`, No-Intro `5a087835…`). If pret's bytes differ from retail, the signature and the table addresses are both suspect. It re-enters in one of two ways.
   - **Owner check.** The owner's retail ROM passes the `test:local` signature check and the smoke fixture §12.6 already gives every owned revision, since the addresses are suspect too. The profile is then `owner`. Its `identify.sha1` lists the No-Intro SHA-1, taken from the No-Intro data that ticket 029's generator reads, because a pret SHA-1 that no retail ROM has would never match a user's ROM.
   - **Repaired chain.** pret's SHA-1 for the build comes to equal No-Intro's. The profile then gets `chain` or `unconfirmed` under item 2.
   - **How it's held.** The generator skips the profile and prints why. It reads the skip list from its committed config, so re-entry is a one-line change. No dead built-in file is committed. A user can still load the revision through a user profile, and the docs say a user profile carries no built-in evidence level.

5. **Where the level is recorded.**
   - **Ledger.** A committed ledger lists the owner's checks: profile ID, the ROM's SHA-1 and the date. `bun run test:local --record` appends an entry after a passing signature check. The ledger holds hashes only, never ROM bytes.
   - **Profile field.** The generator writes `provenance.signatureEvidence: "owner" | "chain" | "unconfirmed"` on each official Gen 3 profile that declares signature words. It derives the value from the ledger and from the pret and No-Intro SHA-1 data that [Generate hash lists from pret and No-Intro](../tickets/029-generate-hash-lists.md) produces. It writes `owner` only from a ledger entry whose SHA-1 is in the profile's `identify.sha1`. This extends the §5.1 `provenance` row.
   - **Mapping test.** A default-suite unit test pins the generator's header-field-to-symbol mapping against the pret header layout at the pinned commit. So `unconfirmed` means "not checked against a real ROM", not "untested".
   - The docs and the release notes are generated from these fields, so they can't drift from them.

6. **No runtime change.** `chain` and `unconfirmed` profiles log nothing extra, and the API is unchanged. `status.game.signature` keeps its four values (§5.4, amendment 025), and the §12.8 rule that the API has no coverage field still holds. The level appears in the profile docs and the release notes only. §5.2 already logs one warning per session for a profile with `fixture: "none"`.

7. **A failed owner check blocks the whole repo.** If an owned revision fails its `test:local` signature check, the generator's mapping is almost certainly wrong for every revision of that pret repo. That failure blocks the release of every profile from the repo until the generator is fixed and the owned revision passes. The fix adds a regression case to the mapping test in item 5. §5.4's "a failing signature is a profile bug" still holds. The exception is an owned revision with a broken chain: its pret build differs from retail, so a failure may come from pret's data, not the generator. That failure keeps only that revision held back under item 4 and doesn't block the repo.

8. **Release gate.** A default-suite test, which runs in CI with no ROMs, gates the release candidate and `v2.0.0`. It checks three things:
   - every shipped official Gen 3 profile that declares signature words has a `signatureEvidence` value that agrees with the ledger and the SHA-1 data,
   - no broken-chain, unowned profile is in the built-in set,
   - the release notes list every shipped profile whose level isn't `owner`, with its level.

   `test:local` alone can't gate a release, because only the owner's machine runs it.

9. **Ruby and Sapphire.** pokeruby's GF header (`src/crt0.s`) has no pointer to the species-info, item or move-data tables, so the Emerald and FireRed signature words don't exist there. Which bytes form their signature goes to a new grilling ticket, "Which bytes form the Ruby/Sapphire signature?". Until it resolves, Ruby and Sapphire profiles declare no signature, and `status.game.signature` is `null` for them. Once their words exist, items 2 to 8 apply. pokeruby is its own repo for the mapping test and the `chain` level. A FireRed or Emerald ROM can't confirm Ruby's mapping. Ruby US 1.0 is a primary revision, so the owner's first Ruby ROM confirms it.

## Spec text this replaces

- §5.4: "`bun run test:local` must confirm each signature against the owner's retail ROM before the profile ships ... Revisions the owner doesn't own have no release rule." Read instead: `test:local` confirms each signature the owner can check, and items 2 to 8 govern the rest.
- §1 Games: "Which revisions count as supported depends on profiles and fixtures (§12.6, §17 item 10)." Signature evidence doesn't decide support. Support stays with §12.6 and §12.8. Item 4 decides which revisions ship as built-in profiles.
- §12.9: "`test:local` also checks each official profile's signature against the owner's ROMs." Add: with `--record` it appends passing checks to the ledger (item 5).
