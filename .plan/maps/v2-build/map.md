# V2 build

## Destination

Pokemon Memory Reader v2.0.0 is published through the release pipeline from the v2-rebuild spec. That means `RELEASING.md` passes for the `v2.0.0` tag and the program, the bridges and `@pokemon-memory-reader/api` are all released. Every feature the spec includes for v2.0 ships, and `beta` and `rc` prereleases mark the milestones on the way.

## Notes

- **This map executes.** It overrides "plan, don't do". Most tickets are `task` tickets that build a slice of v2 and merge it. Grilling, research and prototype tickets appear only where a build slice waits on a decision the spec left open.
- **The spec.** [V2 rebuild](../v2-rebuild/map.md) holds the decisions. After [Consolidated v2 spec](./tickets/001-consolidated-spec.md) resolves, build tickets cite sections of `../v2-rebuild/spec.md` and do not reread the old tickets. If the spec is wrong or silent, open a grilling ticket. Don't decide it inside a build ticket.
- **Execution.** The owner runs this map with the wayfinder-master skill. It uses `wayfinder/v2-build-master`, cut from `wayfinder/v2-rebuild-master`. Children implement with `tdd`. A ticket is done when its acceptance criteria pass in CI and the audit approves.
- **Main stays untouched.** At every batch merge, answer "Keep it on the master branch". Only the final release ticket merges to `main`.
- **Build order.** Skeleton and CI first, then a tracer: mGBA bridge, adapter, Emerald profile, Gen 3 party decoder, `/api/v2/party` and `status`, and a basic Party screen in a compiled executable. After that comes the rest of Gen 3, then RetroArch, the full viewer and icons, and `v2.0.0-beta.1`. Gen 1 and Gen 2, CFRU and hack profiles, BizHawk, the release candidate and `v2.0.0` follow, in that order.
- **No ROMs or emulators yet.** The owner has none on hand for now. AFK tickets test against synthetic buffers, the TypeScript fake bridge, and the Lua core under stock Lua. HITL tickets that need a real emulator, ROM or capture wait until the owner says they're available. Never commit a ROM or ROM bytes.
- **Tooling.** Tooling is already decided in the spec: Bun workspaces (`server/`, `viewer/`, `api/`, `internal/`, `bridges/`), `bun test`, `tsc --noEmit` strict, Biome, and `ci.yml` as defined in the release pipeline decision.
- **Bridge tests.** CI runs the shared Lua protocol core under stock Lua with a fake shim and drives it from Bun tests over TCP. Emulator shims get a HITL smoke test in the real emulator.
- Domain terms live in `/CONTEXT.md`. Keep using them.

## Decisions so far

## Not yet specified

- The rest of Gen 3: player, bag, battle, and boxes resources; FireRed/LeafGreen and Ruby/Sapphire profiles; the full read loop with change detection, the `stalled` flag, SSE topics, and latest-wins queues; full identification (hash, signature, manual picks); and config and `/settings`. This waits on the tracer's code shape.
- The RetroArch adapter over network commands.
- The full viewer: the five screens, the collapsible sidebar, Settings, the hidden opponent party, and icons with the `/icons` route, cache and icon packs.
- The `v2.0.0-beta.1` prerelease: the first real run of the release pipeline, per-OS archives, the update banner, and the API package on npm.
- Gen 1 and Gen 2 data formats, including Gen 1-2 boxes from SRAM.
- CFRU and other hack profiles: name tables, species data, the `RHHEXP` refusal, and the `find-rom-tables` script.
- The BizHawk bridge, which depends on whether the owner has a Windows machine for smoke tests.
- Fixture capture and tier-1 verification for each data format. This hangs on which of the primary ROMs the owner has (Red US 1.0, Crystal US 1.1, Emerald, FireRed and Ruby US 1.0) and on a CFRU hack. A format with no verified fixtures ships with `supported: false`.
- The release candidate, the `RELEASING.md` run for `v2.0.0`, and the merge to `main`.

## Out of scope

- Everything the v2-rebuild map rules out of scope: Gen 4 and later, memory writes, v1 maintenance, package-manager distribution and code signing, and expansion hacks.
- New features or API changes that the v2-rebuild spec doesn't include. Those go into a v2.x map after release.
