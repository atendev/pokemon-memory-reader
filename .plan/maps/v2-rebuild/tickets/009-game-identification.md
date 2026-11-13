---
type: grilling
blocked_by: []
assets: []
---

# Game identification

## Question

How does the app tell which game profile is loaded, especially for ROM hacks whose hash is unknown and whose game code copies the base game?

Profiles reserve an `identify` block (`sha1` list, `gameCode`) from [Game profile source and format](./005-game-profile-source.md). Decide the identification signals and their order, how a Gen 1-2 game without a game code is told apart, how unknown hacks are handled (refuse, guess a base game, or let the user pick a profile in the viewer), and what `status.game` reports when the match is uncertain.

## Answer

The app identifies the ROM by checking signals in a fixed order and records how strong the match was. It never guesses a base profile for a ROM it knows is modified.

- **Signals.** The profile's `identify` block becomes `{ sha1?: [], crc32?: [], header?: {...}, signature?: [...] }`. The app uses `crc32` and `sha1` only when the emulator supplies them (the mGBA bridge gives CRC32, BizHawk gives a hash) and never hashes a ROM over the adapter. `header` holds the GBA game code and software version, or the GB title, mask ROM version and global checksum. `signature` is a list of `{ address, bytes }` checks for hacks that copy a base header.
- **Order.** Exact hash, then header plus signature, then header alone, then a manual pick in the viewer. Hacks still match by hash, because a given patch version applied to the correct base ROM always produces the same bytes.
- **Gen 1-2.** These games use the GB header triple: title, mask ROM version and the 16-bit global checksum. The checksum differs for every official ROM, so it works as a cheap hash. The generator can't derive these values from pret symbols, so they're hand-written or computed by a dev script from the owner's ROMs.
- **Uncertain matches.** If a hash is available, matches nothing, and the header matches a base game, the ROM is modified and stays unidentified until the user picks a profile. Randomizers (Ironmon) land here and pick the base profile, since a randomizer keeps the layouts. If no hash is available and the header matches, the app loads the base profile with an unconfirmed match. If nothing matches, the ROM is unidentified.
- **Status.** This amends [API v2 contract](./006-api-contract.md). `state` gains `"unidentified"` (with `game: null`), `game` gains `match: "exact" | "header" | "manual"`, and `status` always carries `rom: { title, gameCode, revision, crc32, sha1 }`, using `null` for hashes the emulator didn't give. Other resources return `503` with code `unidentified`.
- **When.** The app identifies at attach, then re-reads the header on a slow timer (about 2 s, exact interval left to [Read loop and latency budget](./018-read-loop.md)) and re-identifies whenever the header changes or the adapter reports a content change. A change resets every resource and emits `status` first.
- **Manual picks** are remembered per ROM (hash, or header when no hash exists). Where they're stored belongs to [Config file](./019-config-file.md).

A wrong profile decodes garbage that looks like real data, which is worse for a tracker than showing nothing. That's why a known-modified ROM waits for the user, and only the no-hash case falls back to the header.

Excluded: hashing the ROM through the adapter, auto-loading the base profile for a modified ROM, refusing unknown ROMs outright, and identifying once only at attach.

Amended by [Expansion hack data format](./023-expansion-hack-data-format.md): official Gen 3 profiles carry a vanilla signature, and a header match that fails it stays unidentified until a manual pick, which loads with a warning. A ROM whose scan finds the `RHHEXP` block never loads a non-expansion profile. The viewer notes header-plus-signature matches, and `status.game.signature` reports the result.
