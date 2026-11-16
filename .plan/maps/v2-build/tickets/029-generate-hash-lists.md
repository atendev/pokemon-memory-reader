---
type: task
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794807670
claimed_at: 2026-11-16T05:41:45Z
---

# Generate hash lists from pret and No-Intro

## Question

[Emerald profile and generator](./005-emerald-profile-and-generator.md) copied the Emerald identify hashes into the generator by hand and only checks the SHA-1 against pret's `rom.sha1`. Make `generate:profiles` produce the hash lists itself, per [Where does reference data come from?](./019-reference-data-source.md): SHA-1 from pret, CRC32 from the No-Intro entry with the same SHA-1. Tests run on checked-in excerpts, never a network fetch.

## Acceptance

- The Emerald profile's hashes come from the generator, and a second run gives no diff.
- A SHA-1 with no matching No-Intro entry fails the generator with a clear message.

## Answer

`generate:profiles` now derives each profile's `identify.sha1` and `identify.crc32` itself. The SHA-1 list is every SHA-1 in the pinned pret file, in file order. Each SHA-1 is paired with the CRC32 of the No-Intro entry that has the same SHA-1, read from the DAT pinned in the definition's new `noIntro` field (libretro-database at 5e01cef, `Nintendo - Game Boy Advance.dat` for Emerald). Matching is by SHA-1 only, never by entry name.

A SHA-1 with no No-Intro entry fails the run with a message naming the SHA-1, the pret file and the DAT. Two entries with one SHA-1 and different CRC32 values also fail. Running the generator against the network left the committed Emerald profile unchanged, so a second run gives no diff. Tests run on checked-in excerpts (`fixtures/pokeemerald.rom.sha1` and `fixtures/no-intro-gba.excerpt.dat`), with no ROM bytes and no network.

Excluded: matching by entry name, hand-written hash lists, and recording hash sources in the profile's `provenance` (that is a schema change for a ticket of its own). The failure is a hard stop, not the "leave that revision without hashes" wording in [Where does reference data come from?](./019-reference-data-source.md). A later ticket that adds Sapphire German 1.0, where pret and No-Intro disagree, has to hold that definition back or add a hold-back path.

[Report](../assets/029-generate-hash-lists-report.md). Audit approved in round 1. CI green on f42a2e0 (PR 16).
