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
- The API is a clean break from v1. The viewer (`pokemon-memory-viewer`) gets updated to match.
- The rewrite lives in this repo. The current Lua script gets tagged `v1-lua` and frozen.
- The owner builds v2 mostly with AI agents. Weigh strong types, fast tests, and a single language when choosing tools.
- The owner can produce savestates and RAM dumps from their own games for decoder test fixtures. ROMs never go in the repo.

## Decisions so far

- [Emulator memory access APIs](./tickets/001-emulator-memory-access.md): RetroArch network commands need no bridge, mGBA and BizHawk need Lua bridges, and raw process memory is too fragile to support.
- [What decomp symbol data provides](./tickets/002-decomp-symbol-data.md): prebuilt pret symbols give addresses for every revision but no struct layouts, and CFRU hacks need their own profiles.

## Not yet specified

- How the app identifies a game, especially ROM hacks whose hash is unknown and whose game code copies the base game.
- The battle tracker's data model: which battle state is readable (opponent party, active moves, PP, field effects) and when it's valid.
- PC box reading for each generation, and whether boxes belong in the first release.
- Decoder test fixtures: the dump format, which game states to capture, and whether RAM dumps can be committed.
- Packaging, installers, auto-update, and how emulator bridges get installed.
- Moving the viewer onto the v2 API, and whether it becomes the app's GUI (follows from the form factor ticket).

## Out of scope

- Gen 4 and later (NDS). The adapter design leaves room for it, but this map doesn't plan it.
- Memory writes such as `setMoney` or adding items. v2 only reads.
- Redesigning the viewer frontend.
- Maintaining the v1 Lua script after the `v1-lua` tag.
