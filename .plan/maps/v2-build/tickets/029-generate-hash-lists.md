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
