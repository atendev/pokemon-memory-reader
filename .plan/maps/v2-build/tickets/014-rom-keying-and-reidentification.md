---
type: grilling
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794582779
claimed_at: 2026-11-13T15:12:59Z
---

# How are ROMs keyed and re-identified?

## Question

Spec §17 item 2. Decide how manual picks are keyed when the mGBA bridge sends only `crc32`, how GB ROMs (no game code) are keyed, what happens on RetroArch cores that give no ROM or hash, the header re-read interval, and whether bridge adapters run that timer.

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

A manual pick is keyed by the strongest signal the emulator gives: `sha1:`, else `crc32:`, else a header key tagged with the platform, `header:gba:<gameCode>:<version>:<title>` or `header:gb:<maskRomVersion>:<globalChecksum>:<title>`. On RetroArch without a hash, the key adds `:name:<contentName>`. gpSP, once RetroArch stops sending CRC32, uses `name:<platform>:<contentName>`. An opt-in base-game pick, `base:<profileId>`, covers every modified ROM of an official game that passes the profile's signature, so one pick serves every randomizer seed. Only RetroArch re-checks, every 2 s (`romCheckIntervalMs`), by comparing `GET_STATUS` and the header bytes. Bridges rely on their game message. The mGBA bridge stays CRC32-only, because mGBA master's SHA-1 hashes the unpatched file when mGBA soft-patches a ROM. Full rules are in [the amendment](../assets/014-rom-keying-and-reidentification.md), and every decision is in [the report](../assets/014-rom-keying-and-reidentification-report.md).

Why: hash keys keep hacks built on one base header apart. The global checksum is the GB header field that tells official ROMs apart. RetroArch keys its own per-game overrides by content name. The base-game pick spares randomizer players a pick for every seed. Bridges already send the game message before any read on a new ROM.

Excluded: §9.6's SHA-1-only rule, header keys when a hash exists, a GB key without the checksum, gpSP picks that last only for the session, a base-game pick that applies without asking, `romName` in keys, a timer on bridges, reading the header in every RetroArch batch, and sending mGBA's SHA-1 from the bridge.
