---
type: grilling
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794582779
claimed_at: 2026-11-13T15:12:59Z
---

# Where does reference data come from?

## Question

Spec §17 item 7. Decide where species, move, item and ability names, charmaps, species data, growth curves and move data come from without copying pret C or assembly, which languages ship in v2.0, and where official profiles' `identify.sha1` and `crc32` lists come from.

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

The owner decided this in a three-round grilling on 2026-11-13 and 2026-11-14. [The amendment](../assets/019-reference-data-amendment.md) holds the rules, and spec sections cite it as "amendment 019 §N". [The decision report](../assets/019-reference-data-source-report.md) lists every question, option and audit round.

- **Source.** A dev-time generator reads pinned pret commits and writes only values into committed JSON with provenance (repo, commit, file). It covers names, charmaps, species data and move data. Its output and tests hold no pret C or assembly.
- **Names.** Game text as each game prints it, such as `BULBASAUR` and `POKé BALL`.
- **Languages.** v2.0 ships English only. A profile `language` without shipped data fails the profile check, and a user may set `en` at their own risk.
- **Keys.** Tables are keyed by data format and language. Location names are keyed by `artVersion`. The generator fails if a format's repos disagree on a shared ID.
- **Charmaps.** From pret. Gen 3 decodes strings of Japanese-language mons with the kana set.
- **Growth curves.** Six formulas in decoder code, needed only for Gen 3 and CFRU boxed mons.
- **Hashes.** SHA-1 from pret's per-revision files, and CRC32 from the No-Intro entry with the same SHA-1. A disagreement leaves that revision without hashes, and a test requires both lists on built-in official profiles.

Why: game text matches the screen and hack names read from ROM, and pret has every table in each game's own ID order. mGBA sends only CRC32, so every built-in profile needs one, and No-Intro is the only CRC32 source that needs no ROM.

Excluded: modern names from PokeAPI, dumping tables from the owner's ROMs, runtime ROM reads for official names, any language beyond English in v2.0, silent English fallback, extracted growth tables, hashes from owned ROMs only, and a new `game` profile field.

Open items, such as reading No-Intro's DAT-o-MATIC terms before the release candidate, are in part 12 of the amendment.
