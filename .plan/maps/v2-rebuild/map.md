# V2 rebuild

## Destination

An implementation-ready spec for rebuilding Pokemon Memory Reader as a standalone program that connects to several emulators through adapters and serves a new API. The map ends when someone could build v2 from the spec with nothing left to decide.

## Notes

- Domain terms (adapter, bridge, game profile, decoder) are defined in `/CONTEXT.md`. Use them and keep the file current with the domain-modeling skill.
- Default skills for grilling tickets: grilling and domain-modeling.
- Main users are streamers and challenge runners (Nuzlocke, Ironmon) building overlays and trackers. Developers reach them through the API. Setup must be simple and latency low.
- Games: Gen 1-3, every region and revision the decomp symbol files cover, plus Gen 3 ROM hacks (CFRU-based and decomp-based). The adapter interface must not rule out NDS later.
- Emulator priority at launch: mGBA, then RetroArch, then BizHawk. Raw process memory reading is a research question, not a commitment.
- Platforms: Windows and Linux supported, macOS best effort.
- The API is a clean break from v1. The viewer is a new build in this repo. Treat the old `pokemon-memory-viewer` as if it doesn't exist.
- The rewrite lives in this repo. The current Lua script gets tagged `v1-lua` and frozen.
- The owner builds v2 mostly with AI agents. Weigh strong types, fast tests, and a single language when choosing tools.
- The owner can produce savestates and RAM dumps from their own games for decoder test fixtures. ROMs never go in the repo.

## Decisions so far

- [Emulator memory access APIs](./tickets/001-emulator-memory-access.md): RetroArch network commands need no bridge, mGBA and BizHawk need Lua bridges, and raw process memory is too fragile to support.
- [What decomp symbol data provides](./tickets/002-decomp-symbol-data.md): prebuilt pret symbols give addresses for every revision but no struct layouts, and CFRU hacks need their own profiles.
- [App form factor](./tickets/003-app-form-factor.md): one windowless background program that attaches to a running emulator, auto-probes adapters, serves the API and the viewer on localhost, and uses the viewer as its only GUI.
- [Language and HTTP stack](./tickets/004-language-and-toolkit.md): TypeScript on Bun compiled to one executable, Hono and Zod for the API, and a new React viewer built by Bun and embedded, all in one Bun workspace repo.
- [Game profile source and format](./tickets/005-game-profile-source.md): one JSON profile per ROM revision checked by Zod, addresses generated from pret symbols at dev time, struct layouts in decoder code per data format, and built-in profiles embedded with user profiles loaded from a folder.
- [API v2 contract](./tickets/006-api-contract.md): `/api/v2` REST snapshots plus a topic-filtered SSE stream of whole resources, a `status` resource exposing profile ID and generation, one shape per resource across generations with DVs in `ivs` and null for missing fields, and `503` with a status-carrying error when no game is loaded.
- [License](./tickets/007-license.md): GPL-3.0-or-later for the app, MIT for any package outside code imports, pret and CFRU addresses embedded as facts with provenance, no Nintendo art bundled, and only trimmed RAM slices committed as fixtures.
- [Viewer design](./tickets/008-viewer-design.md): a collapsible-sidebar app with Party (six detail cards, 3x2 when collapsed), Battle (both active mons with VS, trainer card, opponent party), Trainer & bag and Settings screens, using runtime-loaded icons with name fallbacks.
- [Game identification](./tickets/009-game-identification.md): match by emulator-supplied hash, then header plus signature bytes, then header alone, then a manual pick; known-modified ROMs stay `unidentified` until the user picks, and `status` reports `match` and the ROM's header facts.
- [How ROM hacks extend reference data](./tickets/010-hack-reference-data.md): hacks keep Gen 3-charmap name tables at hack-specific addresses, CFRU repoints some ROM header pointers but not move names, and expansion hacks need a per-build layout.
- [What battle state is readable](./tickets/011-battle-state-readability.md): every generation exposes both active mons, the full opponent party from turn one and an in-battle flag that must gate every read, while trainer details are mostly ROM lookups by trainer ID.
- [Battle tracker data model](./tickets/012-battle-tracker-data-model.md): one shape for singles and doubles with player and opponent sides, active only when the in-battle flag is set and the data validates, the full opponent party with a computed `revealed` flag (hidden in the viewer by default), `null` for missing and `"none"` for inactive field state, and a frozen `lastBattle` with outcome and `battleId`.
- [Icon and sprite source](./tickets/016-icon-source.md): PokeAPI/sprites is the best default (tolerated, not licensed, no hotlink terms), and nothing covers Gen 1-2 box icons or hack species.
- [PC box reading](./tickets/013-pc-boxes.md): boxes ship in v2.0 for Gen 1-3 as one whole-resource `boxes` topic plus a per-box snapshot route, read only on demand, with Gen 1-2 non-current boxes from SRAM (stale until saved), box Pokémon reusing the party schema with unstored fields null, a `features.boxes` status flag, and a fifth Boxes viewer screen.
- [Decoder test fixtures](./tickets/014-decoder-fixtures.md): live capture through the real adapter into one base64 JSON fixture per game state (declared reads only, served by a strict `SliceAdapter`), owner-promoted golden files with a `verified` list, no ROM bytes, a tiered coverage matrix whose verified tier 1 states gate each data format's committed `supported` flag, and tier 2 verification fixtures for the battle facts left open.
- [Importable package for overlay developers](./tickets/015-importable-package.md): one MIT npm package `@pokemon-memory-reader/api` in `api/` (replacing `shared/`) with `/types`, `/schemas` and `/client` subpaths, zod as an optional peer, major version equal to the API path version, loose schemas with listed open enums, the viewer using its client instead of `hc`, and no fixtures package.
- [Release pipeline](./tickets/017-release-pipeline.md): per-OS archives, unsigned on Windows and ad-hoc signed on macOS (x64 baseline, arm64 and macOS best effort), built by GitHub Actions from `v<semver>` tags, smoke-tested on native runners (darwin-x64 under Rosetta), published from a draft after a committed `RELEASING.md` checklist; an update banner but no self-update; bridges embedded, written to a per-user data folder, served for download and attached to releases; the API package publishes from `api-v*` tags through npm trusted publishing.
- [Read loop and latency budget](./tickets/018-read-loop.md): one global tick loop at `pollHz` (default 20) reading only demanded resources in one batched call, two-stage change detection (raw bytes, then decoded compare), a `stalled` status flag instead of disconnects on read timeouts (RetroArch still disconnects after 30 s of silence), latest-wins per-topic SSE queues, boxes capped at 1 Hz, and a ~40 ms typical, 73 ms worst-case and 100 ms p99 latency budget outside box cycles, which may add up to 1 s.
- [Config file](./tickets/019-config-file.md): plain JSON `config.json` in the per-OS config folder (XDG on Linux), one `--data-dir`/`PMR_DATA_DIR` override that moves everything, flags beat the file and are never saved, default `http://127.0.0.1:7425`, the viewer saves through a `/settings` route whose writes are loopback-only (reads work on the LAN) with atomic merge writes, user profiles and manual picks in the data folder, and a private `internal/` package for the config and settings contract.

## Not yet specified

<!-- all earlier fog graduated into tickets 009-022 -->

## Out of scope

- Gen 4 and later (NDS). The adapter design leaves room for it, but this map doesn't plan it.
- Memory writes such as `setMoney` or adding items. v2 only reads.
- Maintaining the v1 Lua script after the `v1-lua` tag.
- Package manager distribution (winget, Scoop, AUR, Homebrew), Apple notarization, and Windows code signing at v2.0. The SignPath Foundation application for free Windows signing is a follow-up after v2.0.
