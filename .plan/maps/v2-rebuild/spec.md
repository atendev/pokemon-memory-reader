# V2 rebuild spec

This file folds the 24 resolved tickets of the [V2 rebuild map](./map.md) into one spec, arranged by subsystem. Every "Amended by" note is already applied to the section it changes. Build tickets cite sections by number, such as "spec §7.4", and don't need to reread the old tickets.

- Domain terms follow [`/CONTEXT.md`](../../../CONTEXT.md): adapter, bridge, hello, memory domain, data folder, settings, manual pick, game profile, identification, data format, expansion hack, reference data, name table, species data, API package, viewer, icon pack, art version, resource, battler, side, revealed, last battle, decoder, fixture, slice, box.
- Each section opens with its source tickets. Research assets hold the evidence and the raw tables. A section links them where a builder needs more than the spec carries.
- The spec adds no decisions. Where tickets contradict each other, or leave open something a build slice needs, the text points to an item in [§17 Conflicts and gaps](#17-conflicts-and-gaps). If the spec is wrong or silent anywhere else, open a grilling ticket on the [V2 build map](../v2-build/map.md). Don't decide it inside a build ticket.
- [§16 Decision index](#16-decision-index) maps each line of the rebuild map's Decisions so far to its sections.

## 1. Product shape

Sources: [App form factor](./tickets/003-app-form-factor.md), [Emulator memory access APIs](./tickets/001-emulator-memory-access.md), [Expansion hack data format](./tickets/023-expansion-hack-data-format.md), the [rebuild map](./map.md) Notes and Out of scope.

- **One background program.** v2 is a console program with no native window. It serves the API and the viewer on a local port. The viewer is its only GUI and shows connection status, the detected game, adapter choice and settings. On startup it prints the viewer URL and opens the default browser unless `--no-browser` is passed. A tray icon may come later, and nothing depends on it.
- **Attach, never launch.** The user starts the emulator and loads its bridge or enables its network commands, and v2 connects. An emulator launcher is out of scope.
- **Fully automatic lifecycle.** The adapter retries in the background, the game is re-identified on every ROM change, and the API reports a state instead of erroring (§7.4). There is no manual reconnect.
- **One connection at a time.** Two emulators need two instances on different ports. The data-folder override gives each instance its own settings (§9.3). The adapter interface doesn't rule out multiple sources later.
- **Network.** Binds to `127.0.0.1` by default. A setting can bind a LAN address. The API has no authentication because it is read-only. The docs state the LAN risk. `/settings` writes are the one guarded exception (§9.5).
- **Emulators at launch,** in priority order: mGBA, RetroArch, BizHawk. Raw process memory reading is not supported.
- **Games.** Gen 1-3, every region and revision the pret symbol files cover. Which revisions count as supported depends on profiles and fixtures (§12.6, [§17 item 10](#17-conflicts-and-gaps)). Gen 3 ROM hacks are in scope when they are CFRU-based or keep the official Gen 3 layouts. The adapter interface must not rule out NDS later.
- **Platforms.** Windows and Linux on x64 are supported. arm64 builds and macOS are best effort (§13.1). BizHawk has no macOS build. If Linux BizHawk ships no LuaSocket, BizHawk on Linux is unsupported for now (§4.12). Linux stays supported through mGBA and RetroArch.
- **Users.** Streamers and challenge runners (Nuzlocke, Ironmon) building overlays and trackers. Setup must be simple and latency low.
- **Out of scope for v2.0.** Gen 4 and later, memory writes, v1 maintenance after the `v1-lua` tag, package-manager distribution, Apple notarization and Windows code signing (a SignPath Foundation application follows v2.0), and expansion hacks and other hacks with their own mon layout, such as Run & Bun, Emerald Imperium, Elite Redux, Inclement Emerald and Emerald Rogue (§5.7).

## 2. Repo layout and tooling

Sources: [Language and HTTP stack](./tickets/004-language-and-toolkit.md), [Importable package for overlay developers](./tickets/015-importable-package.md), [Config file](./tickets/019-config-file.md), [Release pipeline](./tickets/017-release-pipeline.md), [Bridge wire protocol](./tickets/022-bridge-wire-protocol.md).

- **Language and runtime.** TypeScript on Bun, shipped as one self-contained executable per OS (`bun build --compile`) with the viewer embedded. Users install no runtime. Bun's built-in TCP and UDP sockets serve every adapter. Expected binary size is about 60-100 MB.
- **HTTP.** Hono on `Bun.serve`. The zod-openapi add-on publishes the OpenAPI document. Hono also runs on Node, which keeps a fallback off Bun open.
- **Schemas.** Zod defines API payloads, the config file and bridge message validation, and types are inferred from it. Decoders build typed objects straight from bytes and skip Zod.
- **Bun workspaces:**

  | Folder | Package | Contents | License |
  |---|---|---|---|
  | `server/` | the program | adapters, decoders, read loop, HTTP routes, bridge wire codec and Zod wire schemas, fixtures under `server/test/fixtures/` | GPL-3.0-or-later |
  | `viewer/` | the viewer | React app bundled by Bun's HTML imports, Tailwind via `bun-plugin-tailwind` | GPL-3.0-or-later |
  | `api/` | `@pokemon-memory-reader/api` | public API schemas, types and client only (§10). Replaces the earlier `shared/` | MIT |
  | `internal/` | `@pokemon-memory-reader/internal`, `"private": true` | the config file schema and the `/settings` route contract as Zod schemas, inferred types and pure helpers | never published |
  | `bridges/` | Lua bridges | the shared Lua protocol core, one shim per emulator, and the build step that joins them (§4.9) | GPL-3.0-or-later |

- **Import rules,** enforced by a lint or test check: `api/` imports nothing from `server/`, `viewer/` or `internal/`. `viewer/` imports nothing from `server/`. `internal/` imports `api/` only for `DEFAULT_PORT` and `DEFAULT_HOST`. `server/` and `viewer/` import `api/` and `internal/`.
- **Workspace resolution.** `server/` and `viewer/` depend on the API package through `workspace:*`. A root `tsconfig.json` `paths` entry maps `@pokemon-memory-reader/api` and its three subpaths to `api/src/`, and `server/tsconfig.json` and `viewer/tsconfig.json` extend the root. Both `tsc` and Bun read `paths` from the tsconfig nearest the importing file, so without `extends` the alias does nothing. The alias lets tests, typecheck, the dev server and the executable read source with no build of `api/`. A check on Bun 1.4.2 confirmed `bun run`, `bun test` and `bun build --compile` resolve source with no `api/dist`. A Vite-based viewer would need the same alias.
- **Viewer bundler.** Bun's HTML imports give hot reload in dev, and `--compile` embeds the result in release. Vite can replace Bun's bundler later without touching app code.
- **Tooling.** `bun test`, `tsc --noEmit` in strict mode, and Biome for lint and format across the repo.
- **Pinned toolchain.** The root `package.json` pins Bun's exact version, and CI reads it through setup-bun's version file. Installs use the committed `bun.lock` with `--frozen-lockfile`.
- **Scripts.** Dev-time scripts named by the tickets: the profile generator (§5.3), `scripts/find-rom-tables` (§5.5, §5.6), the Gen 1-2 header and signature dev script (§5.4), the icon ID-table generator and `check-icon-map` (§11.9), `scripts/smoke.ts` and `scripts/notices.ts` (§13), and `bun run fixture:capture` (§12).
- **v1.** The v1 Lua script is tagged `v1-lua` and frozen. The v2 README links to the tag. Nothing from the old `pokemon-memory-viewer` carries over.

## 3. Adapters and memory domains

Sources: [Emulator memory access APIs](./tickets/001-emulator-memory-access.md) (evidence in [its asset](./assets/001-emulator-memory-access.md)), [App form factor](./tickets/003-app-form-factor.md), [Read loop and latency budget](./tickets/018-read-loop.md), [Bridge wire protocol](./tickets/022-bridge-wire-protocol.md), [PC box reading](./tickets/013-pc-boxes.md).

### 3.1 The adapter

- An adapter is the connection to one emulator. It returns raw bytes from emulated memory and knows nothing about Pokemon.
- Reads are addressed as memory domain plus offset. Each adapter translates them to its emulator's addressing.
- **Batched read.** Each read cycle calls the adapter once with a list of ranges (§8.4). An adapter implements the batch natively or by pipelining.
- **Declared constants.** Each adapter declares a `minIntervalMs` (default 0) and a range merge gap (default 32 bytes, internal).
- **Adapters in v2.0.** One bridge adapter configured by bridge name and endpoint serves both mGBA and BizHawk (§4). RetroArch has its own adapter. Raw process memory reading was rejected: only mGBA has a stable region scan, other emulators need per-build signatures, macOS blocks it without root or a debugger entitlement, and Linux Yama limits it to child processes.

### 3.2 Memory domains

Every adapter, decoder, profile and fixture uses one set of domain names. Each has a fixed u8 code on the bridge wire.

| Platform | Domain | Code | Meaning |
|---|---|---|---|
| GBA | `rom` | 1 | The whole ROM image, addressed by file offset |
| GBA | `ewram` | 2 | EWRAM |
| GBA | `iwram` | 3 | IWRAM |
| GB, GBC | `rom` | 1 | The whole ROM image, addressed by file offset |
| GB, GBC | `wram` | 4 | WRAM, linear across the CGB banks: bank n starts at offset n × 0x1000 |
| GB, GBC | `hram` | 5 | HRAM |
| GB, GBC | `sram` | 6 | Cartridge RAM, which Gen 1-2 boxes need |

- The bridge reports each domain's reachable size in its game message (§4.3). If a shim reaches only part of a domain, such as only the mapped WRAM banks, it reports that size, and range checks fail only the decoders that need the rest.
- Game profiles write addresses as GBA bus addresses (§5.1), which doesn't match this domain-plus-offset rule. See [§17 item 1](#17-conflicts-and-gaps).

### 3.3 Discovery and probing

- At startup the program probes every adapter's configured endpoint (`adapters.<id>` settings, §9.2) in parallel. It connects to the first usable responder in priority order: mGBA, RetroArch, BizHawk.
- How RetroArch is probed and when it counts as usable is not set ([§17 item 14](#17-conflicts-and-gaps)).
- The viewer lists the other adapters so the user can switch. A bridge that becomes usable later doesn't replace the live adapter.
- The `adapter` setting pins one adapter and turns probing off. No value disables every adapter.
- Probe rules for bridges (hello handling, `busy`, held mismatch connections) are in §4.7.

### 3.4 RetroArch adapter

- **Access.** RetroArch's network commands need no bridge. The user enables network commands on UDP port 55355. The adapter sends `READ_CORE_MEMORY <hexaddr> <n>`, which resolves system bus addresses through the core's libretro memory map.
- **Cores.** mGBA, gpSP, Gambatte and SameBoy all publish a memory map:
  - mGBA maps IWRAM at `0x03000000`, EWRAM at `0x02000000`, SRAM at `0x0E000000` and ROM at `0x08000000`, so the header is readable.
  - gpSP maps only IWRAM and EWRAM, so it has no ROM header. Name and species tables are then unavailable (§5.5, §5.6).
  - Gambatte maps WRAM at `0xC000` and `0xD000`, HRAM, ROM at `0x0000`-`0x7FFF`, SRAM at `0xA000`, and CGB WRAM banks 2-7 from `0x10000`.
  - SameBoy's row is in [the asset](./assets/001-emulator-memory-access.md).
- **Batching.** One datagram per range, within RetroArch's 16384-byte and one-descriptor limits. The adapter may raise its merge gap to cut the datagram count. Slices may come from different frames. Replies are matched to requests by the address the reply echoes. The RetroArch adapter spike confirms that format (§15).
- **Hashes.** `GET_STATUS` returns `crc32` in 1.22.2, but RetroArch master has dropped it.
- **SRAM.** Whether RetroArch exposes SRAM to `READ_CORE_MEMORY` is unverified. Without it, Gen 1-2 non-current boxes read as `readable: false` (§7.9).
- **Disconnect.** The adapter is disconnected after 30 s with no reply, because streamers pause for longer than 10 s and a disconnect would blank their overlays (§8.6).

## 4. Bridge wire protocol and bridge delivery

Sources: [Bridge wire protocol](./tickets/022-bridge-wire-protocol.md) (report in [its asset](./assets/022-bridge-wire-protocol-report.md)), [Release pipeline](./tickets/017-release-pipeline.md), [Emulator memory access APIs](./tickets/001-emulator-memory-access.md), [Read loop and latency budget](./tickets/018-read-loop.md), [Config file](./tickets/019-config-file.md). The Lua version constraints come from the build map's [Emulator Lua runtimes](../v2-build/tickets/003-emulator-lua-runtimes.md).

This is bridge protocol 1.

### 4.1 Transport, ports and bridge settings

- Each bridge is a TCP server, and the program connects to it. mGBA uses its built-in `socket` API. BizHawk uses LuaSocket (`require("socket")`), as v1's `network/http_server.lua` and Archipelago's BizHawk connector do.
- Default ports: mGBA 7426, BizHawk 7427. The program never probes v1's port 8080.
- The program writes the configured `adapters.<bridge>.host` and `port` into each bridge, in both the data-folder copy and the file served at `/bridges/<name>.lua`. The bridge binds to that host.
- For the bridge adapters, `host` must be an IPv4 or IPv6 literal, so the bridge binds to exactly the address the program connects to and never resolves a name. The settings schema rejects hostnames and the wildcards `0.0.0.0` and `::`.
- For a remote setup, the user sets `host` to the emulator machine's address and loads the bridge there. That exposes read-only memory access on that network, as the LAN note in §1 says.
- The program rewrites a data-folder bridge whenever the generated file differs from the one on disk, which covers version and settings changes. Release-asset copies carry the defaults (`127.0.0.1` and the default port).
- After a host or port change, nothing listens on the new endpoint until the user reloads the bridge. The adapter is disconnected, and the viewer's connection screen shows the install steps, which begin with loading or reloading the bridge from the data folder.

### 4.2 Frames

Every frame is `u32 length | u8 kind | u32 id | body`, big-endian. `length` counts every byte after the length field.

| Kind | Value | Direction | Body | Largest body |
|---|---|---|---|---|
| `HELLO` | 1 | bridge to program | JSON | 4 KiB |
| `GAME` | 2 | bridge to program | JSON | 4 KiB |
| `READ` | 3 | program to bridge | binary | 4,610 bytes (512 ranges) |
| `DATA` | 4 | bridge to program | binary | 64 KiB |
| `ERROR` | 5 | bridge to program | JSON | 4 KiB |

- A frame whose `length` exceeds its kind's largest body plus the 5 header bytes, or whose kind is unknown, is a bad frame. The receiver doesn't wait for the rest of it.
- Unprompted messages use id 0. Request ids start at 1 on each connection, go up by one and skip 0 when they wrap. A reply carries the id of its request.

### 4.3 Hello and game messages

- **Hello.** Sent unprompted as the first frame on every connection, including connections the bridge then refuses. Body: `{ bridge: "mgba" | "bizhawk", protocol: 1, build: string, emulator: { name: string, version: string | null } }`. `build` is the app version the bridge came from. It appears in logs and `status.adapter.bridge` and never affects compatibility. Only `protocol` decides compatibility, and it changes only when the wire changes.
- **Game message.** Sent right after the hello and again whenever a ROM loads, unloads or changes. The body is `null` with no ROM, otherwise `{ platform: "gb" | "gba" | "other", romName: string | null, crc32: string | null, sha1: string | null, domains: { [name]: size } }`. Hashes are lowercase hex.
  - The mGBA bridge fills `crc32` from `emu:checksum(C.CHECKSUM.CRC32)`.
  - The BizHawk bridge fills `sha1` from `gameinfo.getromhash()`, with any `SHA1:` prefix stripped, only for cores the spike confirmed return a SHA-1, and null for every other core.
  - `romName` appears only in logs. The game code and title come from the program's own header read.
  - `platform: "other"` (a BizHawk system outside GB, GBC and GBA) leaves the ROM unidentified.
- The game message is how a bridge adapter reports a ROM change, which triggers re-identification (§5.4). The bridge sends it before answering any read on the new ROM, and the adapter drops every reply to a request it sent before that message arrived.

### 4.4 Reads

- A `READ` body is a `u16` range count, then `u8 domain | u32 offset | u32 length` per range. The `DATA` body is the bytes of every range in request order with nothing between them.
- The bridge reads every range in one script callback, so one reply is one sample.
- A request holds at most 512 ranges and 64 KiB of data. The adapter splits only `rom` reads larger than that, such as name and species tables, because ROM doesn't change between requests. It never splits a RAM read. The Gen 3 PC storage read (about 33.6 KB) fits in one request. A test checks that each decoder's declared RAM reads fit the caps.
- The wire carries direct ranges only. Pointer-derived regions are resolved by the program (§8.5).
- **Range checks.** Before sending, the adapter checks each range against the domain sizes from the game message, drops a bad range and fails only the decoders that asked for it. The bridge checks again and answers a request with any bad range with one error for the whole request.

### 4.5 Requests in flight and unusable replies

- The adapter keeps at most one unanswered request per connection. While a request is inside its 250 ms timeout, the cycle waits, and ticks that pass are skipped as an overrunning cycle (§8.1).
- After the timeout the cycle ends as a timeout, but the request still counts as unanswered until its late reply arrives, and the adapter discards that reply. Each tick that comes while a timed-out request is unanswered sends nothing and counts as a timeout. A pause therefore never queues requests in the bridge.
- An `ERROR` with id 0 answers no request and is routed by code: `busy` sets that problem, and `bad_frame` is logged before the bridge closes the connection.
- The adapter logs and drops a `DATA` or `ERROR` whose id matches no pending request, and a `DATA` body whose length differs from the sum of the requested lengths. A dropped reply gives that cycle no data, and the connection stays open. A dropped reply that carried the pending request's id still frees the in-flight slot.

### 4.6 Errors

An `ERROR` body is `{ code, message }` with the failed request's id, or 0.

| Code | Meaning | Connection |
|---|---|---|
| `bad_frame` | The bridge can't parse a frame | The bridge sends the error, then closes |
| `busy` | A second client connected | The bridge sends the error, then closes that connection |
| `no_game` | A read arrived with no ROM loaded | The adapter treats it like a null game message |
| `bad_range` | Program bug | Stays open |
| `too_large` | Program bug | Stays open |
| `unknown_kind` | A known kind sent in the wrong direction, such as `DATA` to the bridge. A kind outside the table is a bad frame | Stays open |
| `internal` | A Lua error caught by `pcall`, text in `message`, truncated to fit 4 KiB | Stays open |

- The adapter logs program bugs and internal errors at most once a minute per code, and that cycle gets no data.
- Errors never count toward `stalled`. An unknown error code is treated as `internal`.
- The bridge runs its whole step under `pcall`. An error inside a request handler answers that request with `internal`. An error anywhere else (accepting, receiving, framing, dispatch) makes the bridge log it and close the client connection, so the adapter sees a close and reconnects. A request therefore goes unanswered on an open socket only while the emulator doesn't run scripts, and `stalled` shows that.

### 4.7 Hello handling, probes and problems

- **Hello timer.** 3 s from each new connection. If no hello arrives, the adapter reports `unknown_bridge` but keeps the socket open, and a late hello clears it. That covers a paused emulator that answers only after unpause.
- **Two-step check.**
  1. A JSON object with a string `bridge` and an integer `protocol`. If `protocol` differs from the program's, the adapter reports `protocol_mismatch` and sends nothing. A protocol difference always wins over step 2, so a newer bridge whose hello changed shape is still a mismatch.
  2. Only a hello with the program's protocol goes through the full schema.
- **Before a valid hello,** any failure is `unknown_bridge`: the first frame isn't a hello, a frame doesn't parse, or the hello fails step 2, or fails step 1 for a reason other than a protocol difference. A protocol difference is reported as `protocol_mismatch`. The adapter closes the socket and reconnects with backoff.
- **Wrong bridge.** A hello whose `bridge` differs from the endpoint's adapter, such as `mgba` answering on `adapters.bizhawk`, is also `unknown_bridge`. The adapter copies that hello into `status.adapter.bridge` so the viewer can name the bridge that answered and point at the port settings. It logs it, sends no reads, closes and retries with backoff.
- **After a valid hello,** a failure is `bridge_error`:
  - A frame that doesn't parse closes the socket, and the adapter reconnects with backoff.
  - A game body that fails validation leaves the socket open with no reads. The next valid game message on that socket clears `bridge_error`. On a new connection, a valid hello and game message clear it.
  - An error body that fails validation counts as `internal`, and the connection carries on.
- **A refused TCP connect** is not a problem. No bridge is listening, so the adapter stays disconnected and retries, and the viewer shows the install steps (§4.11).
- **One client.** A bridge serves one connection at a time. It sends the hello to every new connection, so probes learn which bridge answered, then sends `busy` to a second connection and closes it.
  - The program closes each probe connection right after the hello, whatever it says, unless that adapter becomes the live one. It never probes the endpoint it is connected to.
  - One exception: while no adapter is usable and the bridge `status.adapter` describes has `protocol_mismatch`, the program keeps that connection open and idle. A bridge reload then shows as a close, and the program reconnects at once without filling the emulator console. A switch to that adapter reuses the open connection.
  - `busy` therefore means another program instance holds the bridge.
- **Usability.** A bridge with any problem is not usable. Probing chooses only among usable adapters, and problem bridges show in the viewer's adapter list. While no adapter is usable, `state` is `"disconnected"` and `status.adapter` describes the problem bridge that comes first in priority order. The viewer then shows reload steps that point at this program's own data-folder copy and download. For `protocol_mismatch` it also says whether the loaded bridge is older or newer than the program.
- **Two schemas.** `server/` holds strict wire schemas: they ignore unknown keys and unknown domain names, and reject unknown `bridge` and `platform` values. The API package holds the loose public `status.adapter.bridge` and `problem` shapes with open enums. The program copies a hello into `status` only after the strict wire check, except for a mismatch, where it copies only `bridge` and `protocol`.

### 4.8 Liveness and pause

- A closed socket is the only disconnect signal for the bridges. The adapter notices a peer close whether or not a request is pending. There is no ping message. The program turns on TCP keepalive so a remote setup notices a dead network.
- Each bridge answers whenever its emulator lets scripts run. The BizHawk bridge loops on `emu.yield()`. The mGBA bridge answers from frame callbacks unless the spike finds a way to run while paused. The program relies on neither, so `stalled` means no replies, not that the emulator is paused.

### 4.9 Bridge source and tests

- One Lua protocol core holds the framing, dispatch, a small JSON encoder, the request checks and the protocol constant. A thin shim per emulator holds the socket calls, domain mapping, game info and callbacks. A build step joins core and shim into `mgba.lua` and `bizhawk.lua`.
- Bridges need Lua 5.3 or later for `string.pack`, and they print a console message and stop if it's missing. Per [Emulator Lua runtimes](../v2-build/tickets/003-emulator-lua-runtimes.md), the core targets Lua 5.3 and 5.4 and avoids 5.5 changes, string arithmetic and `require`. Shims wrap each emulator's sockets.
- CI runs the core under stock Lua 5.4 with a fake shim against test vectors the TypeScript encoder produces, and checks that the Lua and TypeScript protocol constants match.
- `server/` holds the wire decoders. A hand-written decoder reads frame headers and binary bodies and checks their lengths. Zod checks the hello, game and error bodies.
- A TypeScript `FakeBridge` speaks the protocol in adapter tests.
- `RELEASING.md` gains a manual smoke check per emulator.

### 4.10 Bridge behaviour

- A bridge keeps a send buffer, because a non-blocking send can be partial.
- If its bind fails, it logs the port and the setting that controls it, then retries every 2 s. That covers a reload while the old socket still holds the port.
- It logs only that it is listening, bind errors, and the start and end of a serving session. A session starts at the first `READ` after a connect, so probes don't fill the console.

### 4.11 Delivery and install

- **Embedded.** The bridges are embedded in the executable. On startup the program writes `mgba.lua` and `bizhawk.lua` to `<data folder>/bridges/` (paths in §9.1), rewriting them when the generated content differs. If the write fails, it logs once and carries on.
- **Served.** `GET /bridges/<name>.lua` serves each bridge from an allowlist of known names, so no request path reaches the filesystem.
- **Release assets.** The release workflow attaches the same `.lua` files, with default settings, for users who run the emulator on another machine. Bridge, archive and assets come from the same commit.
- **Install steps.** The viewer's connection screen shows the data-folder path with a copy button, a download button per bridge, and steps per emulator:
  - mGBA: Tools > Scripting > File > Load script, with a note that 0.11 and later can pass `--script`. The implementer checks that 0.11 shipped `--script` before writing the note. mGBA 0.10.x has it only on master.
  - BizHawk: the exact `--lua=<path>` command line, or loading the script in the Lua console.
  - RetroArch: enable network commands on port 55355.
- **Compatibility.** The hello's protocol integer is separate from the app version and bumps only on wire changes. A mismatch is refused, and a bridge that sends no hello, such as a v1-style script, is an unknown bridge. In both cases `status` lets the viewer tell the user to reload the bridge from the data folder or the download link.

### 4.12 Spike items with decided fallbacks

| Spike question | Fallback if the answer is no |
|---|---|
| Does Linux BizHawk ship LuaSocket? | The docs say BizHawk on Linux is unsupported for now |
| Does mGBA run socket callbacks while paused? | The bridge answers only on frames |
| Does `emu.yield()` keep the BizHawk bridge answering while paused? | The bridge loops on `emu.frameadvance()` and answers only on frames |
| Can mGBA expose every CGB WRAM bank? | The shim reports the size it can reach (§3.2) |
| Which BizHawk cores return a SHA-1 from `gameinfo.getromhash()`? | `sha1` only for confirmed cores, null for the rest |
| Can mGBA rebind the port right after a script reload? | The 2 s bind retry covers it |
| Does mGBA expose its version to scripts? | `emulator.version` is null |

## 5. Game profiles, the generator and identification

Sources: [Game profile source and format](./tickets/005-game-profile-source.md), [What decomp symbol data provides](./tickets/002-decomp-symbol-data.md) (evidence in [its asset](./assets/002-decomp-symbol-data.md)), [Game identification](./tickets/009-game-identification.md), [How ROM hacks extend reference data](./tickets/010-hack-reference-data.md) (evidence in [its asset](./assets/010-hack-reference-data.md)), [ROM hack name tables](./tickets/020-hack-name-tables.md), [Icon loading and fallbacks](./tickets/021-icon-loading.md), [Expansion hack data format](./tickets/023-expansion-hack-data-format.md) (evidence in [its asset](./assets/023-expansion-hack-data-format.md)), [Hack species data](./tickets/024-hack-species-data.md) (evidence in [its asset](./assets/024-hack-species-data.md)), [Decoder test fixtures](./tickets/014-decoder-fixtures.md), [Battle tracker data model](./tickets/012-battle-tracker-data-model.md), [PC box reading](./tickets/013-pc-boxes.md).

### 5.1 The profile file

A game profile is one JSON file per ROM revision. One Zod schema checks every profile and is also exported as JSON Schema so editors autocomplete hand-written profiles. Built-in and user profiles use the same format and loader.

| Field | Rule |
|---|---|
| `id` | Lowercase `<game>-<region>-<revision>`, such as `firered-us-1.0`, `ruby-de-1.1` or `crystal-us-1.1`. Hacks use their own slug, such as `radical-red-4.1`. Exposed as `status.game.profileId` |
| `kind` | Required, `"official" \| "hack"`. Not inherited through `extends`, so a hack that extends `firered-us-1.0` states `"hack"` itself |
| `extends` | Optional, one parent profile. The child overrides individual fields. Blue extends Red, and a hack can extend `firered-us-1.0` |
| data format | Names one data format: Gen 1, Gen 2, Gen 3 or CFRU (§6.1). Exposed as `status.game.dataFormat` |
| `language` | Selects reference data (§6.2) |
| `artVersion` | Required. One of `red-blue`, `red-green-japan`, `yellow`, `gold`, `silver`, `crystal`, `ruby-sapphire`, `emerald`, `firered-leafgreen`. Japanese Red and Green use `red-green-japan`. A hack sets its base game's value |
| addresses | Hex strings such as `"0x02024284"`, or a pointer entry `{ "ptr": "0x...", "offset": "0x..." }`. For a pointer entry the program reads the pointer, then reads at its target plus the offset. Emerald and FireRed save blocks and `gPokemonStoragePtr` use pointer entries, and Ruby/Sapphire use static ones, so one Gen 3 decoder serves all of them. See [§17 item 1](#17-conflicts-and-gaps) for the notation conflict |
| constants | Per-game constants, hand-written |
| `identify` | `{ sha1?: string[], crc32?: string[], header?: {...}, signature?: [{ address, bytes }] }` (§5.4) |
| `nameTables` | Required on `kind: "hack"`, optional on official profiles, where omission means reference data (§5.5) |
| `speciesData` | Required on `kind: "hack"` (§5.6) |
| trainer tables | Optional ROM table locations (`gTrainers`, `gTrainerClassNames`, `gTrainerMoneyTable`). A missing table nulls the fields that depend on it and never raises an error (§7.8) |
| `fixture` | Committed `"full" \| "smoke" \| "none"`, checked by a test against the fixture folder (§12.8) |
| provenance | For generated profiles: pret repo, commit SHA and symbol file. For a hack `.sym`: the hack, its version and the file's SHA-256 |

- Profiles hold no names. Species, move and item names and charmaps are reference data keyed by generation and language (§6.2). Hack profiles say where name tables sit in ROM but never hold the names.
- Struct layouts for game-state structs live in decoder code as typed offset tables, one set per data format. A hack that changes a struct layout needs a code change and a release. Hack name-table entry layouts are the one exception: they live in the profile (§5.5), because they change with each hack build.
- The full field list has open points, such as a display name for `status.game.name`, which fields `extends` inherits, and how a hack profile marks boxes unsupported. See [§17 item 6](#17-conflicts-and-gaps).

### 5.2 Loading

- Built-in profiles are embedded in the executable at build.
- The program also reads `<data folder>/profiles/` (§9.1). A user profile with the same ID replaces the built-in one. The program creates the empty folder at startup so the viewer can show its path.
- A profile whose data format isn't `supported` loads, and its resources return `503 unsupported` (§12.8).
- A profile with `fixture: "none"` loads normally, and the program logs one warning per session naming the profile ID and saying it has no fixture.

### 5.3 The generator

- A dev-time generator reads the pret `symbols` branches and extracts a hand-kept list of symbols per generation, such as `gPlayerParty`, `gSaveBlock1Ptr` and `wPartyMons`. Its output is committed and reviewed as a diff. The program never fetches symbols.
- **Symbol files.** Every pret repo in scope (pokered, pokeyellow, pokegold, pokecrystal, pokeruby, pokeemerald, pokefirered) publishes a prebuilt `symbols` branch.
  - Game Boy repos give `.sym` and `.map` files with `bank:address label` lines and no sizes.
  - GBA repos give objdump-style `.sym` files with sizes. Ruby and FireRed have one file per revision (rev1, rev2, German, rev10 Switch). Emerald has a single English file.
  - Emerald and FireRed expose `gSaveBlock1Ptr`, `gSaveBlock2Ptr` and `gPokemonStoragePtr` as IWRAM pointers, dereferenced at read time, as are `gBattleStruct` and `gBattleResources`. Ruby/Sapphire save blocks are static. `gBattleMons`, `gBattleTypeFlags` and `gPlayerParty` are plain symbols.
- **Hand-written.** Struct layouts, per-game constants, every CFRU hack profile, and Gen 1-2 header values (the generator can't derive them from symbols). The Gen 1-2 header values are hand-written or computed by a dev script from the owner's ROMs.
- **Vanilla signatures.** For official Gen 3 profiles the generator writes the expected values of the GF ROM header words that point to the species, item and move tables, from pret symbols (§5.4).
- **Hack builds.** The generator also accepts the `.sym` that `make syms` writes for a hack build and records the hack, its version and the file's SHA-256 as provenance. It reads no `.map` files. v2.0 ships no finder for game-state addresses, so a hack release without a matching `.sym` needs them found by hand. `scripts/find-rom-tables` finds only name and species tables (§5.5, §5.6). A smoke fixture catches a self-built `.sym` that doesn't match the released ROM.
- CFRU and Radical Red patch a vanilla FireRed 1.0 ROM through `BPRE.ld` and a generated `offsets.ini`, so they have no general symbol file, and each hack needs its own profile.

### 5.4 Identification

- **Signals.**
  - `crc32` and `sha1`, used only when the emulator supplies them: the mGBA bridge gives CRC32, BizHawk gives SHA-1 on confirmed cores, and RetroArch 1.22.2 gives CRC32. The program never hashes a ROM over the adapter.
  - `header`: the GBA game code and software version, or the GB title, mask ROM version and 16-bit global checksum. The global checksum differs for every official GB ROM, so it works as a cheap hash.
  - `signature`: a list of `{ address, bytes }` checks for hacks that copy a base header, and the vanilla signature on official Gen 3 profiles.
- **Order.** Exact hash, then header plus signature, then header alone, then a manual pick in the viewer. Hacks still match by hash, because a given patch version on the correct base ROM always gives the same bytes.
- **Modified ROMs.** Header matching, with or without a signature, applies only when the emulator supplied no hash.
  - A supplied hash that matches nothing, while the header matches a base game, means the ROM is modified. It stays `unidentified` until the user picks a profile. Randomizers such as Ironmon land here and pick the base profile, since a randomizer keeps the layouts.
  - With no hash available and a matching header, the program loads the base profile with `match: "header"`.
  - If nothing matches, the ROM is `unidentified`.
- **Vanilla signature.** Each official Gen 3 profile carries a signature of the GF ROM header words that point to the species, item and move tables.
  - The program checks the signature of every profile that declares one, whatever the match path.
  - A header match whose signature fails, or can't be read, counts as a modified ROM and stays `unidentified` until a manual pick.
  - On an emulator that gives no hash, a header-plus-signature match still loads without a manual pick. A hack that keeps the retail header and the three table pointers but changes struct layouts passes the signature and loads the official profile. That is a known gap.
  - [Expansion hack data format](./tickets/023-expansion-hack-data-format.md) expects the signature to catch CFRU, which it says repoints the species-data pointer at `0x080001BC`, and expansion hacks, which are expected to move all three tables. [Hack species data](./tickets/024-hack-species-data.md) says that repoint comes from DPE's `repointall`, not CFRU's, so a CFRU build without DPE may leave the word on the vanilla table. Whether the signature still catches such builds is open ([§17 item 11](#17-conflicts-and-gaps)). No hack ROM has been checked, and a `test:local` run against the owner's hack ROMs confirms it.
  - `bun run test:local` must confirm each signature against the owner's retail ROM before the profile ships, and a failing signature is a profile bug. A game with no GF ROM header gets other retail bytes picked with the Gen 1-2 dev script. Revisions the owner doesn't own have no release rule. See [§17 item 10](#17-conflicts-and-gaps).
- **`status.game.signature`.** `"match" | "mismatch" | "unchecked" | null`, a closed enum. `"unchecked"` means a signature word couldn't be read, as when the adapter can't read ROM. `null` means the profile declares no signature, as in Gen 1-2.
  - With `match: "manual"`, the viewer warns on `"mismatch"` that the ROM's data tables moved and values may be wrong, and on `"unchecked"` that the program couldn't check the ROM.
  - After an exact hash match, `"mismatch"` means the profile's own signature is wrong: the program logs a profile error and the viewer shows no table warning.
  - With `match: "header"`, the viewer shows a small note that the ROM matched by header, and by signature where the profile has one, not by hash.
- **Manual picks.** On a ROM without a detected expansion block, a manual pick of an official profile loads even when the signature failed, with the warning above. Without ROM reads, a pick loads with `"unchecked"` and its warning. Picks are remembered per ROM in `manual-picks.json` (§9.6). The key rules conflict between tickets and leave hashless, headerless adapters open. See [§17 item 2](#17-conflicts-and-gaps).
- **Expansion block.** A ROM where the scan finds `RHHEXP` loads no profile, whether by hash, header or manual pick (§5.7).
- **When.** The program identifies at attach, then re-reads the header on a slow timer, "about 2 s" with the exact interval not set ([§17 item 2](#17-conflicts-and-gaps)), and re-identifies when the header changes or the adapter reports a content change, such as a bridge game message. A change resets every resource and emits `status` first.
- **ROM tables load before `game`.** After identification, declared name and species tables load (§5.5, §5.6). The state stays `no_game` until they finish or fail, about 0.25-1 s per game load.
- **Why it's strict.** A wrong profile decodes garbage that looks real, which is worse for a tracker than nothing. That is why a known-modified ROM waits for the user and only the no-hash case falls back to the header.

### 5.5 Hack name tables

- A hack profile declares where its name tables sit in ROM. The program reads them once after identification and keeps them for the session. No per-hack name data ships, and names are never cached in the data folder.
- Official profiles use shipped reference data and read no names from ROM.
- **Shape.** `nameTables` has the keys `species`, `moves`, `items` and `abilities`. A `kind: "hack"` profile must list all four, each as a table or the literal `"vanilla"`, and Zod rejects an omission. `"vanilla"` means the category uses reference data and reports `"builtin"`. It is a deliberate choice for a category the hack left alone, never a fallback for a failed table.
- **Table.** `{ base, count, stride, nameOffset?, name }`. `base` uses the address form of §5.1, so a header pointer is `{ "ptr": "0x08000144", "offset": "0x0" }`. `count` is required, and `nameOffset` defaults to 0. `name` is `{ kind: "inline", length }` only: fixed-width names inside the entry, as in CFRU name arrays or the vanilla item struct with stride `0x2C` and a 14-byte name. A later expansion data format may add a `pointer` kind back without breaking profile files.
- **Facts behind it.** Gen 3 hacks keep names in the Gen 3 charmap, 0xFF-terminated, in fixed-width entries padded with 0xFF. CFRU and DPE use flat arrays indexed by u16 ID (species 11 bytes, moves 13, abilities 17 in CFRU). They repoint the header pointers at `0x08000144` (species names) and `0x080001C0` (abilities), but not the move-name pointer at `0x08000148`, so move names need a profile-declared address.
- **Loading.** Tables load in chunks of at most 64 KiB (§4.4) before `status.state` becomes `game`. A table that fails doesn't hold the state back. Its category is marked unavailable, and the state moves on.
- **Validation.** Each table is checked as a whole. Every entry needs a 0xFF terminator within its `length` and only bytes defined in the Gen 3 charmap. The share of non-empty entries must meet a named constant, set to 90% until a real hack ROM is checked. A failing table is discarded whole and logged.
- **Failure.** A discarded table, an ID beyond `count`, an empty entry in a valid table, and missing ROM access all give `name: null` for that category, with no fallback to official names, because the hack's IDs no longer match. `id` is always present, and the viewer renders `#<id>` itself.
- **No ROM access.** If the adapter can't read cartridge space (RetroArch's gpSP core) or the ROM read errors, every category declared as a table gives `name: null`. Everything else still decodes. The viewer suggests a core that maps ROM, such as RetroArch's mGBA core.
- **Status.** `status.game.names: { species, moves, items, abilities }`, each `"builtin" | "rom" | "unavailable"` (closed) or `null` when the generation has no such names, such as `abilities` in Gen 1-2.
- **Finding addresses.** The owner runs `scripts/find-rom-tables` against their own local ROM. It searches for charmap-encoded first entries, infers base, stride and count, and prints a `nameTables` fragment to review (and a `speciesData` fragment, §5.6). The ROM never enters the repo. Built-in hack profiles, Radical Red included, are only those the owner wrote this way and checked against fixtures. Fixtures hold no ROM bytes, so the ROM tables themselves are checked only by synthetic tests and `test:local` (§12.2). A profile is removed if its hack's author objects. Other hacks are covered by user profiles, and the script is documented for their authors.

### 5.6 Hack species data

- A hack profile declares where its species tables sit in ROM, and the program reads them with the name tables. Official profiles keep shipped reference data.
- **Shape.** Every `kind: "hack"` profile has a required `speciesData: { info, dex, exp }`. Each key is a table or `"vanilla"`, which reports `"builtin"`. Zod rejects an omission. `info` and `dex` are `{ base, count }`, with `count` capped at 65535. `exp` is `{ base, maxLevel }`. `base` uses the address form of §5.1.
- **Layout,** in data-format code:
  - The Gen 3 `info` entry has `genderRatio` at 0x10, `growthRate` at 0x13 and abilities at 0x16 and 0x17. Experience rows hold 101 levels.
  - CFRU uses the same entry plus a u8 `hiddenAbility` at 0x1A. Its rows hold 256 levels.
  - Both strides are 0x1C. The research infers this, but no source states it, so it must be confirmed before either decoder ships. See [§17 item 11](#17-conflicts-and-gaps).
  - A `dex` entry is a u16, and entry `i` is species `i + 1`.
- **Computed fields.**
  - `gender` uses `genderRatio`.
  - The Gen 3 decoder picks the ability slot by bit 31 of the misc substructure's IV word, as the official games do. The CFRU decoder takes `hiddenAbility` when that bit is set and `hiddenAbility` is non-zero. Otherwise it takes slot 1 when `personality & 1` is 0 or slot 2 is empty, and slot 2 in every other case, as CFRU's `GetMonAbility` does.
  - A boxed mon's `level` is `null` when its experience is above the `maxLevel` entry of its `growthRate` row, checked first, so experience equal to that entry gives `maxLevel`. Otherwise it follows pokefirered's `GetLevelFromBoxMonExp`: start at level 1, count up while the row entry at that level is at or below the experience and the level is at most `maxLevel`, then subtract 1. A result of 0 gives `null`. That CFRU levels box mons the same way is inferred, and a boxed-mon fixture confirms it.
  - `exp: "vanilla"` uses the six Gen 3 curves in code with `maxLevel` 100.
  - Forms report their base species' National Dex number. A `dex` entry of 0 gives `null`.
  - A battler's `ability` comes from battle memory.
- **Loading.** Same window as name tables, in chunks of at most 64 KiB. CFRU's tables are about 36 KiB (`info`), 2.6 KiB (`dex`) and 6 KiB (`exp`). A failing table doesn't hold the state back.
- **Validation,** each table whole, discarded whole and logged on failure:
  - A `base` that doesn't resolve into cartridge space (`0x08000000`-`0x09FFFFFF`), or a table whose last byte lies beyond `0x09FFFFFF`, fails.
  - `info`: the share of non-empty entries (base stat total above 0, entry 0 excluded) meets the 90% constant. Every non-empty entry has `growthRate` of 5 or less and ability IDs, `hiddenAbility` included on CFRU, below the abilities name table's `count`, or below the vanilla Gen 3 ability count when abilities are `"vanilla"`.
  - `dex`: every value at or below `MAX_NATIONAL_DEX` (1025), and the non-zero share meets the 90% constant.
  - `exp`: `maxLevel` below the data format's row length, and all six rows non-decreasing from level 1 to `maxLevel`.
  - The thresholds are rechecked against a real hack ROM.
- **Lookups outside a valid table.** One entry failing validation fails the whole table. A valid table can still give `null` for a single lookup that falls outside it, such as experience above the `maxLevel` entry or a `dex` entry of 0.
- **Failure.** Nothing falls back to official data.
  - `info` fails: `gender`, the party and box `ability`, and a boxed mon's `level` are `null`.
  - `exp` fails: a boxed mon's `level` is `null`.
  - `dex` fails: `species.dex` is `null`.
  - No ROM access makes every declared table unavailable, and the viewer's suggestion of a core that maps ROM covers these tables too.
- **Status.** `status.game.speciesData: { info, dex, exp }`, each `"builtin" | "rom" | "unavailable"` (closed). Official profiles report `"builtin"` for all three in every generation.
- **Finding addresses.** `scripts/find-rom-tables` finds the `info` table by Bulbasaur's base stats, the `dex` table by its known opening values and the `exp` table by the Medium Fast row. A CFRU build without DPE may leave header word `0x080001BC` on the vanilla table, so `base` comes from the script's output, and a profile uses the header-pointer form only when the owner confirms the header was repointed.

### 5.7 Expansion hacks

- v2.0 ships no data format or profile for pokeemerald-expansion hacks or other hacks whose mon layout differs from the official games'. A later map starts from [the research](./assets/023-expansion-hack-data-format.md), which records why: no shared layout, no published symbols, and battle state that changed across many expansion versions.
- **Detection.** At identification the program scans ROM from `0x08000100` to `0x08000400` in 2-byte steps for the `RHHEXP` magic. From expansion 1.7.2 the block follows the GF ROM header, near `0x08000200`, though its exact offset is unconfirmed. Hacks built before 1.13.0 can lack it, and hacks before 1.7.0 have none. Those rely on the hash and the signature.
- **Refusal.** A ROM where the scan finds the block stays `unidentified`, whatever the match path. The viewer names the expansion version and says v2.0 doesn't read it. Only a later expansion data format may load such a ROM.
- **Status.** `status.rom.expansion: { version, tagged } | null`. `version` is `"<major>.<minor>.<patch>"` from the block, and `tagged` is bit 0 of its flags byte. A hack built from an untagged commit reports the next patch number with `tagged: false`. `null` means the scan found no block or the adapter can't read ROM, not that the ROM isn't an expansion hack.
- A manual pick of an official profile on a layout-changing hack without the block, or a header match in the gap of §5.4, still reads it with vanilla layouts. The signature warning is the only guard on a manual pick.
- **Hacks in reach.** CFRU hacks use the CFRU data format. Hacks that keep the official Gen 3 mon and save layouts use the Gen 3 data format through a hack profile or a manual pick of the official profile, whether made by editing a retail ROM or built from pret's decomp.

## 6. Data formats, decoders and reference data

Sources: [Game profile source and format](./tickets/005-game-profile-source.md), [API v2 contract](./tickets/006-api-contract.md), [What battle state is readable](./tickets/011-battle-state-readability.md) (evidence in [its asset](./assets/011-battle-state-readability.md)), [Battle tracker data model](./tickets/012-battle-tracker-data-model.md), [PC box reading](./tickets/013-pc-boxes.md), [Decoder test fixtures](./tickets/014-decoder-fixtures.md), [ROM hack name tables](./tickets/020-hack-name-tables.md), [Hack species data](./tickets/024-hack-species-data.md), [License](./tickets/007-license.md).

### 6.1 Data formats and decoders

- v2.0 has four data formats, each with one decoder: Gen 1, Gen 2, Gen 3 and CFRU. `dataFormat` separates CFRU from vanilla Gen 3 in `status`.
- Decoders turn raw bytes into domain data and produce typed objects without Zod.
- **Declared reads.** Each decoder declares what it reads as a function of the profile, in two phases: static regions `{ domain, offset, length }` and pointer-derived regions `{ ptrEntry, length }`. Lengths cover the maximum (a full party, all boxes), never only what the current state uses. The read loop batches these (§8.4), the capture tool records them (§12.4), and the `SliceAdapter` enforces them (§12.3).
- **Support flag.** Whether a data format is supported is a committed `supported` flag in the decoder registry. A test allows `true` only when every tier 1 state passes with its required fields verified on every primary revision of that format (§12.8). A decoder may merge with synthetic tests alone.
- **Gen 3.** Decoding needs the substructure order table (24 orders) and the checksum routine. Party, box and enemy-party mons share them.
- **CFRU** keeps vanilla FireRed addresses for the core battle globals, but adds its own battle type bits, terrain and a `gNewBS` struct, and relocates `gTrainers`. It uses the Gen 3 `info` entry plus `hiddenAbility` and 256-level experience rows (§5.6).
- **Struct layouts** are written by hand from the pret C headers and RGBDS macros, once per generation, since no ELF with debug info is published.

### 6.2 Reference data

- Species, move, item and ability names, charmaps, and the numeric facts decoders need (species data such as gender ratio, ability slots, growth rate and National Dex number, plus the Gen 3 growth-rate experience table) ship as reference data keyed by generation and language. A profile states its `language`.
- Official profiles use reference data for names and species data, and report `"builtin"` in `status.game.names` and `status.game.speciesData`.
- The repo and executable bundle names and numeric reference data but no sprites, artwork or audio (§14).
- A language counts as supported only after it has a smoke fixture, which covers its charmap (§12.6).
- Where reference data comes from, which languages ship, and where `identify` hashes come from are not decided. See [§17 item 7](#17-conflicts-and-gaps).

### 6.3 Mapping generations onto one shape

These are decoder rules. The decoder does all generation-specific math, so clients never do.

| Field | Gen 1 | Gen 2 | Gen 3 and CFRU |
|---|---|---|---|
| `ivs` | DVs 0-15. `spa` and `spd` both get the Special DV. `hp` gets the derived HP DV | Same as Gen 1 | IVs |
| `evs` | Stat Experience 0-65535. `spa` and `spd` both get Special Stat Exp | Same as Gen 1 | EVs |
| `stats` | `spa` and `spd` both get the Special stat | Separate | Separate |
| `ability` | `null` | `null` | From reference data, or hack species data (§5.6) |
| `nature` | `null` | `null` | Computed |
| `heldItem` | `null` | Read | Read |
| `gender` | `null` | Computed from DVs | Computed from the personality value |
| `hiddenPower` | `null` | Computed | Computed |
| `shiny` | Contradictory, see [§17 item 4](#17-conflicts-and-gaps) | Computed from DVs | Computed from the personality value and trainer IDs |

- No rescaling: DVs stay 0-15 and Stat Experience stays 0-65535.
- `species` is `{ id, dex, name }`: `id` is the game's internal index, `dex` the National Dex number or `null` for hack-only species, and `name` the decoded name or `null` (§5.5).
- Strings are UTF-8, decoded through the game's charmap.

### 6.4 Battle state per format

- **In-battle flag.** Gen 1 `wIsInBattle`, Gen 2 `wBattleMode`, and `gMain.inBattle` in Gen 3 and CFRU. Every battle read is gated on it.
- **Stale buffers.** Gen 1-2 enemy buffers share unions with wild tables and link data. Gen 3 globals such as `gBattleTypeFlags`, `gBattleOutcome` and `gBattleMons` stay stale after a battle. The outcome is read on the in-battle transition.
- **Opponent party** readable from the first turn of a trainer battle: `wEnemyMon1..6` (Gen 1), `wOTPartyMon1..6` (Gen 2), `gEnemyParty` (Gen 3). Only Gen 2 and Gen 3 have held items.
- **Trainer details** are mostly ROM lookups keyed by a trainer ID: `gTrainerBattleOpponent_A`, `wOtherTrainerID`, `wTrainerNo`.
- The full battle resource is §7.8.

### 6.5 Boxes per format

| | Gen 1 | Gen 2 | Gen 3 and CFRU |
|---|---|---|---|
| Boxes × slots | 12 × 20 | 14 × 20 | 14 × 30 |
| Live memory | Current box in WRAM | Current box in WRAM | All of `PokemonStorage` in RAM, one contiguous read of about 33 KB. `currentBox` is its first byte |
| Other boxes | Cartridge SRAM, as fresh as the last save or box switch | Same as Gen 1 | n/a |
| Address | Profile | Profile | Static `gPokemonStorage` (Ruby, Sapphire) or the `gPokemonStoragePtr` pointer entry (Emerald, FireRed) |
| Box names | None, `null` | Yes | Up to 8 characters |
| Wallpaper | `null` | `null` | Game index as a number |
| Corruption | No checksums. An invalid species gives a `null` slot, not listed in `corruptSlots` | Same as Gen 1 | A checksum failure or bad egg gives a `null` slot listed in `corruptSlots` |

- The Gen 2 name length and charmap, and the absence of Gen 1 names and Gen 2 wallpapers, must be verified against the pret disassemblies before implementing.
- Gen 1-2 slots are decoded by position, ignoring the count byte and the species terminator list. Gen 1-2 SRAM boxes are trusted as stored: the program doesn't verify the save checksum. The current box always comes from WRAM and replaces its SRAM copy.
- Both corruption cases log one warning per box index and slot until the game changes.
- The resource is §7.9.

## 7. Resources and the API v2 contract

Sources: [API v2 contract](./tickets/006-api-contract.md), [What battle state is readable](./tickets/011-battle-state-readability.md), and every ticket that amends the contract: [Game identification](./tickets/009-game-identification.md), [Battle tracker data model](./tickets/012-battle-tracker-data-model.md), [PC box reading](./tickets/013-pc-boxes.md), [Importable package for overlay developers](./tickets/015-importable-package.md), [Read loop and latency budget](./tickets/018-read-loop.md), [ROM hack name tables](./tickets/020-hack-name-tables.md), [Bridge wire protocol](./tickets/022-bridge-wire-protocol.md), [Expansion hack data format](./tickets/023-expansion-hack-data-format.md), [Hack species data](./tickets/024-hack-species-data.md).

### 7.1 Transport and conventions

- Read-only JSON over HTTP. `GET /api/v2/<resource>` returns a snapshot. `GET /api/v2/events?topics=party,battle` is one SSE stream per page, filtered by topic, which avoids the browser's six-connections-per-origin limit. WebSocket was rejected because the API is read-only.
- Resources in v2.0: `status`, `player`, `party`, `bag`, `battle` and `boxes`. Each resource is also a stream topic. `GET /api/v2/boxes/:n` returns one box and is not a topic.
- Successful responses aren't wrapped in an envelope. JSON keys are camelCase. Strings are UTF-8.
- **Versioning.** Path prefix `/api/v2`, with only additive changes inside it. A breaking change means `/api/v3`. OpenAPI is served at `/api/v2/openapi.json`.
- **CORS.** `Access-Control-Allow-Origin: *`. Private Network Access preflights get `Access-Control-Allow-Private-Network: true`, so hosted HTTPS overlays can reach localhost. No auth.
- **Raw memory.** No raw read in the public contract. A raw-read route exists only under `--debug`, outside `/api/v2`, with no stability promise. Its path is not set ([§17 item 9](#17-conflicts-and-gaps)).
- **Documentation.** Each field's Zod `.describe()` states its range and which generations fill it, which flows into OpenAPI. The API docs carry one "Generation differences" table and list fast-forward as a limitation (§8.7). Responses carry no range metadata, because `status.game.generation` picks the row.

### 7.2 Errors

- `status` always returns `200`.
- Other resources return `503 { error: { code, message }, status }` when no data exists, where `status` is the current status resource.

| Code | When | HTTP |
|---|---|---|
| `disconnected` | No usable adapter | 503 |
| `no_game` | Connected, no ROM or ROM tables still loading | 503 |
| `unidentified` | A ROM is loaded but no profile matched | 503 |
| `unsupported` | The profile's data format isn't `supported`, the profile marks the resource unsupported (`features.boxes` false), or the adapter can't perform the resource's main read | 503 |
| `not_found` | `GET /boxes/:n` with an out-of-range or non-integer `:n` | 404 |

- `code` is an open enum (§7.11).
- For `/boxes/:n`, the 503 checks run before `:n` validation. A valid `:n` whose box is unreadable returns `200` with `readable: false`.
- The SSE route returns `400` before the stream opens if `topics` is missing or names no known topic, and it ignores requested topics it doesn't know.
- The 503 code for a cold read that times out while a game is loaded (§8.2), and the `400` body, are not set. See [§17 item 8](#17-conflicts-and-gaps).

### 7.3 The SSE stream

- Each event is named after its resource and carries the whole new resource, never a diff or a refetch notice.
- On connect, the stream sends the current value of every subscribed topic, so clients need no first fetch. A topic with no data yet is held until it has data.
- Once open, the stream never emits an error. It keeps emitting `status` and holds other topics until they have data. With no game, a disconnected adapter or an unsupported profile, the `boxes` topic stays silent.
- Delivery rules (latest-wins queues, heartbeat, slow-client close) are in §8.8.

### 7.4 `status`

```ts
status = {
  state: "disconnected" | "no_game" | "unidentified" | "game",
  adapter: {
    id: "mgba" | "retroarch" | "bizhawk",            // open enum
    stalled: boolean,                                 // §8.6
    bridge: {                                         // hello body, or null for RetroArch or no hello yet
      bridge: "mgba" | "bizhawk",                     // open enum
      protocol: number,
      build: string | null,                           // null on protocol_mismatch
      emulator: { name: string, version: string | null } | null,  // null on protocol_mismatch
    } | null,
    problem: "unknown_bridge" | "protocol_mismatch" | "busy" | "bridge_error" | null,  // open enum
    // other adapter fields: not set, §17 item 8
  } | null,
  rom: {
    title, gameCode, revision,                        // from the program's header read
    crc32: string | null, sha1: string | null,        // null when the emulator didn't give it
    expansion: { version: string, tagged: boolean } | null,  // §5.7
  },
  game: {
    profileId, name, generation, language,
    dataFormat,                                       // open enum
    match: "exact" | "header" | "manual",
    signature: "match" | "mismatch" | "unchecked" | null,  // §5.4; values per 023's body, see §17 item 13
    features: { boxes: boolean },                     // may gain booleans later
    names: { species, moves, items, abilities },      // each "builtin" | "rom" | "unavailable" | null
    speciesData: { info, dex, exp },                  // each "builtin" | "rom" | "unavailable"
  } | null,
}
```

- `game` is `null` unless `state` is `"game"`. [PC box reading](./tickets/013-pc-boxes.md) writes `features` as `{ boxes } | null`, null while no game is loaded, which `game: null` already covers.
- `features.boxes` is per profile, not per adapter, and promises data from at least the current box. It is false when the profile's data format doesn't support boxes. Hack profiles with an unverified storage layout set it false, and CFRU and other hacks keep it false until that profile has a box fixture. How a profile sets it is open ([§17 item 6](#17-conflicts-and-gaps)).
- While no adapter is usable, `state` is `"disconnected"` and `adapter` describes the highest-priority bridge with a problem (§4.7).
- The value of `rom` while disconnected or with no ROM, and the nullability of its header fields, are not set. See [§17 item 8](#17-conflicts-and-gaps).
- A game change resets every resource and emits `status` first.

### 7.5 The shared Pokémon schema

One `Pokemon` schema serves `party`, box slots and `opponent.party`, with one shape across generations. A field a generation lacks is `null`, never omitted, so keys stay stable.

Decided fields:

- `species: { id, dex: number | null, name: string | null }`.
- `nickname`, OT name and OT ID, null where no buffer exists, such as Gen 1-2 wild opponents.
- An egg marker. Clients check it before showing a boxed egg's `level`.
- `level`.
- `hp`, `maxHp`, `stats` and `status`, all nullable (box Pokémon, §7.9).
- `ivs`, `evs` and `stats` with keys `hp, atk, def, spa, spd, spe` (§6.3).
- `ability` and `heldItem` as `{ id, name }` references or `null`. `nature`, `null` in Gen 1-2, in a representation not yet set.
- `moves` as `{ id, name }` references.
- Computed: `shiny` (boolean), `gender` (`"male" | "female" | "genderless"`, `null` in Gen 1) and `hiddenPower` (`{ type, power }`, `null` in Gen 1).

Reference rules:

- Species, move, item and ability references are `{ id, name: string | null }` (species adds `dex`). `id` is always present.
- `name` is `null` for an ID beyond a name table's `count`, an empty entry, a discarded table or missing ROM access (§5.5).

Hack profiles:

- `gender`, `ability`, `species.dex` and a boxed mon's `level` come from hack species data. They are `null` only when a table fails, its `base` doesn't resolve into ROM, the adapter can't read ROM, or a lookup falls outside a valid table (§5.6).

Open: the full field list and types (the egg marker's name, ball, experience, friendship and others), whether party Pokémon carry `types`, party move fields (`pp`, `maxPp`, move type for the viewer's type icons), the status-condition and type enums, Gen 1 `shiny`, and where hack profiles get types and move data. See [§17 item 4](#17-conflicts-and-gaps).

### 7.6 `player`

Name, trainer ID and secret ID, money, badges, map location and play time. The shapes of badges, map location and play time are not set. See [§17 item 5](#17-conflicts-and-gaps).

### 7.7 `party` and `bag`

- `party` is the player's party as `Pokemon` entries. During an Emerald multi or in-game-partner battle, if the game loads partner mons into player party memory, `party` shows them, and its `.describe()` notes this (§7.8).
- `bag` is the bag by pocket. The pocket list per generation and the entry shape are not set. See [§17 item 5](#17-conflicts-and-gaps).

### 7.8 `battle`

The resource is a union discriminated by `active`. The key-stability rule applies within each variant.

```ts
inactive = { active: false, lastBattle: LastBattle | null }
active = {
  active: true, battleId: number,
  kind: "wild" | "trainer", format: "single" | "double", modes: string[], turn: number | null,
  player:   { active: Battler[], partner: Trainer | null },
  opponent: { active: Battler[], party: OpponentMon[], trainers: Trainer[] },
  field: { weather, terrain, sides: { player: SideConditions, opponent: SideConditions } },
}
```

`lastBattle` is never carried while a battle is active.

**When it flips.**

- It goes active when the in-battle flag is set and the data validates: a non-zero opponent active species and a party count from 1 to 6. The flag is set when Gen 1 `wIsInBattle` is 1 or 2, Gen 2 `wBattleMode` is 1 or 2, or Gen 3/CFRU `gMain.inBattle` is set.
- While the flag is set and validation fails, the resource stays at its last valid state (inactive until the first valid read) and emits nothing. There is no timer. A test feeds an invalid frame sequence and asserts that it doesn't flip.
- It goes inactive as soon as the flag clears, and the outcome is read on that transition. `{ active: false, lastBattle }` goes out only after the flag reads clear.
- Gen 1 `wIsInBattle == -1` (`0xFF`) is an end marker: inactive with outcome `lost`. Whether the Gen 1-2 `unknown` fallback below also covers this case is open ([§17 item 13](#17-conflicts-and-gaps)).
- Warnings: [Battle tracker data model](./tickets/012-battle-tracker-data-model.md) logs one de-duplicated warning per battle, and [Read loop](./tickets/018-read-loop.md) warns after 2 s of consecutive failures. See [§17 item 13](#17-conflicts-and-gaps).

**`battleId`.**

- A counter the program increments each time `battle` goes active, on the active shape and on `lastBattle`.
- It resets to 0, and `lastBattle` becomes null, on a game change or a program restart. An adapter reconnect resets them only if the identified game changed, so a reconnect mid-battle doesn't log the encounter twice.
- `.describe()` says it is unique only within one session.

**Kind, format, modes.**

- `kind`: Gen 1 and Gen 2 use 1 for wild and 2 for trainer. Gen 3 and CFRU are trainer when `gBattleTypeFlags & BATTLE_TYPE_TRAINER` (bit 3) is set.
- `format`: from `BATTLE_TYPE_DOUBLE` (bit 0). Gen 1-2 are always `single`. In Gen 3 and CFRU, two-opponent battles are `double`.
- `modes`: draws from a fixed enum mapped from each generation's flags. v2.0 ships only the values verified against fixtures, from `safari`, `link`, `tutorial`, `facility`, `roamer` and `legendary`. A mode that can't be captured (link needs two emulators, facility needs a post-game save) is dropped from the v2.0 enum instead of blocking the release. Unknown bits are ignored, and raw flag bits are not exposed. Whether this enum may gain values within `/api/v2` is contested. See [§17 item 3](#17-conflicts-and-gaps).
- `turn`: filled only where fixture work verifies a counter address, otherwise `null`. The program doesn't count turns.

**Sides.**

- `active` holds one battler in singles and two in doubles, ordered by battler position.
- `trainers` is empty in wild battles, and two-opponent battles have two entries.
- In wild battles `opponent.party` holds only the wild mons on the field: one in singles, two in hack wild doubles.

**`Battler`.** `{ position, owner: "player" | "partner" | "opponent", partySlot: number | null, species, level, types, hp, maxHp, status, ability, heldItem, moves, stats, statStages }`.

- `species`, `heldItem`, `status`, `stats` and `ability` use the `Pokemon` types. Each move extends `{ id, name }` with `pp` and `maxPp`.
- Values are live from the battle struct, so a Transformed mon shows the copied species, types and moves. `types` falls back to the species table if the struct has none. Hack profiles declare no types table ([§17 item 4](#17-conflicts-and-gaps)).
- The real mon sits at `partySlot`, in `party` for the player side and in `opponent.party` for the opponent. `partySlot` indexes the side's party exactly as the game stores it. It is null only for partner battlers whose mons aren't in party memory.
- `statStages { atk, def, spa, spd, spe, acc, eva }` is normalized to −6..+6 in every generation. Gen 1's single Special stage fills both `spa` and `spd`.
- `ability` and `heldItem` are null where the generation lacks them. Every battler includes `stats`.
- Volatile statuses are left out of v2.0 and can be added later.

**`OpponentMon`.** `Pokemon` plus `partySlot`, `trainer: number | null` (an index into `trainers`, null for wild) and `revealed`.

- Gen 1-2 wild mons are built from the battle struct. Their DVs fill `ivs`, so `shiny`, `gender` and `hiddenPower` are computed.
- `nickname` is filled where a buffer exists (Gen 1 `wEnemyMonNick`). `evs`, OT name and OT ID are null.
- A fixture confirms the DV read before this ships.

**`revealed`,** computed by the program as best effort:

- A trainer mon is revealed once any valid frame lists its slot as an opponent battler's `partySlot`, and it stays revealed for the battle. HP below max also counts, as a proxy for a mon sent out before the program attached.
- A wild mon is always revealed.
- `.describe()` says that if the program attaches mid-battle, a mon sent out earlier that is back at full HP reads as unrevealed.

**`field`.**

- `weather`: `"none" | "rain" | "sun" | "sandstorm" | "hail" | null`.
- `terrain`: `"none" | "electric" | "grassy" | "misty" | "psychic" | null`.
- `SideConditions`: `{ reflect, lightScreen, safeguard, mist: boolean | null, spikes: number | null }`.
- `null` means the generation or data format lacks the value: weather and spikes in Gen 1, terrain outside CFRU, safeguard and mist in Gen 1. `"none"`, `false` and `0` mean tracked but inactive.
- Gen 1's per-mon reflect and light screen bits map to the side of the mon that holds them.
- CFRU rooms (Trick Room, Gravity and so on) wait until the `gNewBS` layout is read.

**`Trainer`.** `{ id, classId, className, name, prizeMoney, items: Item[] | null }`.

- Fields come from the profile's optional ROM tables (§5.1). A missing table nulls the fields that depend on it. In fixture tests the tables count as missing, so these fields decode to null (§12.2). In link, Tower and Frontier battles, table-derived fields are null.
- `prizeMoney` is the expected payout on a win, null when any input is missing or `gBattleStruct` can't be read. "Last mon" is the trainer's highest occupied party slot. Pay Day money is not included.
  - Gen 1: `wTrainerBaseMoney` (BCD) × last mon's level.
  - Gen 2: `wEnemyTrainerBaseReward` × last mon's level.
  - Gen 3 and CFRU (`GetTrainerMoneyToGive`): `4 × lastMonLevel × gBattleStruct->moneyMultiplier × gTrainerMoneyTable[classId].value`, × 2 when `BATTLE_TYPE_DOUBLE` is set. Each trainer in a two-opponent battle gets its own amount.
  - The Gen 1-2 formulas come from game knowledge and are confirmed by fixture against `wAmountMoneyWon` and `wBattleReward` after a win. Until then Gen 1-2 `prizeMoney` is null.
- `items` holds the remaining items in Gen 2, the starting list in Gen 3, and null in Gen 1. `.describe()` says which.

**`LastBattle`.** `{ battleId, outcome, endedAt, kind, format, modes, trainers, opponentParty }`.

- `endedAt` is an ISO 8601 UTC string from the program's clock. Everything except the outcome and timestamp is frozen from the last valid active snapshot.
- `outcome`: `"won" | "lost" | "drew" | "ran" | "caught" | "forfeited" | "unknown"`.
  - Gen 3 and CFRU mask `gBattleOutcome` with `0x7F`, then map 1 → won, 2 → lost, 3 → drew, 4 and 5 → ran, 7 → caught, 9 → forfeited, and anything else → unknown.
  - Gen 1-2 mask `wBattleResult` with `0x3F`, then map 0 → won, 1 → lost and 2 → drew in trainer battles. In wild battles, 0 is won only if the wild mon's last HP was 0, otherwise unknown. Lost and drew map as in trainer battles. The mask and mapping come from game knowledge and are confirmed by fixture. Until then Gen 1-2 outcomes are `unknown`.
- The program never infers an outcome from party changes. `.describe()` lists which outcomes each generation can report.

**Fallbacks until the verification fixtures land** (§12.7): `turn` null, unverified modes left out of the enum, partner `partySlot` null, Gen 1-2 `prizeMoney` null, Gen 1-2 outcomes `unknown`.

### 7.9 `boxes`

```ts
boxes = { currentBox: number | null, boxes: Box[] }
Box = { index: number, name: string | null, wallpaper: number | null,
        readable: boolean, corruptSlots: number[], slots: (Pokemon | null)[] }
```

- `index` and `currentBox` are 0-based. A readable box's `slots` has a fixed length (20 for Gen 1-2, 30 for Gen 3) in game slot order, with `null` for empty slots so indices hold.
- An unreadable box has `readable: false`, `slots: []` and `corruptSlots: []`, and keeps `name` and `wallpaper` where known. When a Gen 3 storage block fails to read, every box is unreadable and `currentBox` is `null`.
- `corruptSlots` is never omitted (`[]` by default), so a tracker can tell empty from corrupt.
- **Box Pokémon** use the `Pokemon` schema. Fields a box doesn't store are `null`: `hp`, `maxHp`, `stats` and `status` in Gen 2 and Gen 3, and `stats` and `maxHp` in Gen 1. Gen 3 `level` is computed from experience and the growth rate (§5.6 for hacks). Gen 1-2 use the stored level. No stats are computed in v2.0. A boxed Gen 3 egg's `level` is computed like any other. `.describe()` lists the null fields.
- **Staleness.** Gen 1-2 non-current boxes are only as fresh as the last in-game save or box switch, and `.describe()` and the docs say so. With no SRAM domain, only the current box is readable, the others are `readable: false`, the resource still returns `200`, and `features.boxes` stays true.
- **Routes.** `GET /api/v2/boxes` returns the whole resource. `GET /api/v2/boxes/:n` returns one `Box` (§7.2 for errors). The `boxes` topic carries the whole resource in every event and is pushed only to subscribers.
- **Reads** are on demand only, at most once a second (§8.3). The program hashes the raw bytes of every region read (the WRAM current box plus each SRAM box) and emits only when a hash changes. `GET` reuses the latest read if it is under 1 s old, otherwise it triggers a read.
- **Size.** About 33 KB per Gen 3 read and about 0.4 MB per full event, sent only to subscribers.
- [PC box reading](./tickets/013-pc-boxes.md) names an mGBA GDB-stub 512-byte cap that would need chunking, while [Bridge wire protocol](./tickets/022-bridge-wire-protocol.md) makes the mGBA adapter a Lua bridge with a 64 KiB cap (§4.4). See [§17 item 13](#17-conflicts-and-gaps).

### 7.10 What clients can rely on

- One shape per resource across generations. The real differences (ranges, the shared Special, derived gender and shininess) are documented or computed on the server.
- The `status.game.generation` value picks the row of the "Generation differences" table.

### 7.11 Forward compatibility

- Published schemas are loose objects that keep unknown keys.
- Open enums are typed as the known union plus `(string & {})` and validated as strings: error `code`, `dataFormat`, adapter `id`, topic names, `status.adapter.problem` and `status.adapter.bridge.bridge`. The contract docs list them.
- Every other enum, such as `gender` and `status.state`, is closed and never gains a value within `/api/v2`. A server test fails if a closed enum changes. `battle.modes` conflicts with this rule ([§17 item 3](#17-conflicts-and-gaps)).

## 8. Read loop and latency budget

Sources: [Read loop and latency budget](./tickets/018-read-loop.md), [Bridge wire protocol](./tickets/022-bridge-wire-protocol.md), [PC box reading](./tickets/013-pc-boxes.md), [Battle tracker data model](./tickets/012-battle-tracker-data-model.md).

### 8.1 Loop

- One global tick loop at `pollHz`, default 20 (50 ms), range 5-60. An out-of-range `pollHz` is clamped with a logged warning.
- The effective interval is the larger of `1000 / pollHz` and the adapter's `minIntervalMs`.
- A cycle that overruns skips the missed ticks and never queues.
- A warm GET serves the cached value without touching the adapter. Cold-resource and stale-box GETs are the only exceptions.

### 8.2 Demand

- Only resources with an SSE subscriber or a GET in the last 5 s are read. `status` and the in-battle flag are always read. `battle` counts as demanded while the in-battle flag is set, so `lastBattle` is complete when nobody is subscribed.
- **Cold GET.** A GET on a cold resource runs one extra cycle at once, serialized with the loop, and waits for it.
  - The cold read runs right after the current main batch and ahead of any box request that hasn't started. If a box request is in flight, the cold cycle waits for it, bounded by the 1000 ms box timeout.
  - The 250 ms read timeout counts from the start of the cold read itself. A cold GET therefore takes at most about 1.25 s with a box request in flight, and about 500 ms otherwise.
  - Cold GETs that arrive together share one cold cycle.
  - An SSE subscriber to a cold topic gets the same extra cycle and receives the first decoded value as its on-connect event.
  - With no game loaded, or a cold read that times out or returns nothing, the GET gets a `503` and the stream holds the topic. The code for the timeout case is open ([§17 item 8](#17-conflicts-and-gaps)).

### 8.3 Boxes

- Read only when demanded and at most once per 1000 ms (`boxesMinIntervalMs`, internal), in their own request, serialized after the main batch in the same cycle.
- The main batch is decoded and emitted before the box request starts, but a game change that lands during the box read waits for it.
- The box request has its own 1000 ms timeout. A box cycle can delay a change by up to that long, which relaxes the battle tracker's one-tick rule on box cycles only. A box timeout doesn't count toward `stalled`.
- A GET on a cache older than 1 s triggers one immediate box read with the cold-read ordering and waits at most about 2.25 s. If that read times out, the GET returns the stale cache, not a `503`.
- SSE subscribers get box pushes at 1 Hz at most.

### 8.4 Batching

- Each cycle takes the union of the declared ranges for demanded resources, merges ranges within a domain only (merge gap per adapter, default 32 bytes), and calls the adapter once. Boxes are the one separate call. No rule covers a merged batch that exceeds the bridge caps ([§17 item 14](#17-conflicts-and-gaps)).
- Bridge adapters send one `READ` (§4.4). RetroArch sends one datagram per range (§3.4).

### 8.5 Pointer-derived regions

- Each batch reads the pointer words for pointer-derived regions and addresses those regions with the pointer values from the previous batch that read them.
- If a pointer word changed, results that used it are dropped for that cycle, and the next cycle reads the new address. Box requests follow the same rule with their own pointer.
- When no pointer value is known (attach, game change, cold read), the cycle sends two requests in sequence: pointer words only, then the regions at those pointers plus the pointer words again. The second reply is the cycle's sample, under the same changed-pointer rule.
- Steady-state cycles send one request. Bridge adapters keep at most one request in flight (§4.5).

### 8.6 Change detection, consistency and stalls

- **Two stages.** Compare each resource's raw slice bytes to the last tick's and skip decoding when equal. Otherwise decode, deep-compare to the last emitted value, and emit only on a difference.
  - The in-battle flag is part of the `battle` raw key, so a flag change always forces a decode.
  - The first successful decode always emits and doubles as the on-connect value.
  - A decode or validation failure emits nothing and leaves state unchanged.
- **Consistency.** The in-battle flag is read in the same batch. While the flag is set and battle data fails validation, the program keeps the last valid state, emits nothing, counts the failure and retries next tick (§7.8). Other resources rely on their decoder's checks, such as the Gen 3 checksum. No debounce, no double read.
- **Timeouts and stalls.** Each batch has a 250 ms timeout. A timeout means no data this tick: the program keeps the last values and emits nothing. After 1 s of consecutive timeouts, `status.adapter.stalled` becomes `true`, and the next good read clears it. Cold-read timeouts count. Box timeouts and bridge errors don't.
- **Disconnects.** mGBA and BizHawk are disconnected only when the socket closes, so a paused emulator keeps its data indefinitely. RetroArch is disconnected after 30 s with no reply.
- Replies are correlated to requests (by id for the bridges), and a late reply is discarded.

### 8.7 Fast-forward

No special handling. The loop samples on wall-clock ticks, so intermediate states can be missed. The API docs list this.

### 8.8 Slow clients

- Each SSE client holds at most one pending event per topic, and latest wins: a newer event replaces the queued one and goes to the tail. On-connect values and `status` follow the same rule. There is no cross-topic ordering promise.
- A client whose socket stays unwritable for 30 s is closed as a normal end of stream. Its `EventSource` reconnects and gets the on-connect values.
- A comment heartbeat goes out every 15 s.

### 8.9 Latency budget

- From the emulator frame where the game changes to the SSE write on localhost, at 20 Hz:
  - tick wait: 25 ms on average, 50 ms at most
  - frame-gated reply: up to about 17 ms, 8 ms on average
  - decode and diff: under 5 ms
  - write: about 1 ms
- That gives about 40 ms typical, 73 ms worst case, and a target p99 of at most 100 ms.
- The figures exclude stall, timeout and box cycles. Outside box cycles, `battle` lands within one tick. On a box cycle, add the box read time, capped at 1000 ms.
- The figures assume one frame per RetroArch reply, and they scale with `pollHz`: at 5 Hz the tick wait adds up to 200 ms.

### 8.10 Constants and observability

- `pollHz` is the only user-visible loop setting.
- Internal constants: 250 ms read timeout, 1 s stall threshold, 30 s UDP disconnect, merge gap, 5 s warm window, 1 s box interval, 1000 ms box timeout, 30 s drain limit, 15 s heartbeat.
- Every adapter uses the same `pollHz`, and `minIntervalMs` defaults to 0. The RetroArch spike sets a floor only if its measurement needs one.
- Counters for tick, read and decode duration, skipped ticks, per-client drops and validation failures are served at `GET /debug/metrics` under `--debug` only (§9.9). The public `status` gains only `stalled`.

## 9. Config, the data folder and settings

Sources: [Config file](./tickets/019-config-file.md), [Release pipeline](./tickets/017-release-pipeline.md), [Icon loading and fallbacks](./tickets/021-icon-loading.md), [Bridge wire protocol](./tickets/022-bridge-wire-protocol.md), [App form factor](./tickets/003-app-form-factor.md), [Read loop and latency budget](./tickets/018-read-loop.md), [Battle tracker data model](./tickets/012-battle-tracker-data-model.md), [Game identification](./tickets/009-game-identification.md).

### 9.1 The data folder

| OS | Data folder | `config.json` |
|---|---|---|
| Windows | `%APPDATA%\pokemon-memory-reader\` | in the data folder |
| Linux | `$XDG_DATA_HOME/pokemon-memory-reader/` (falls back to `~/.local/share`) | `$XDG_CONFIG_HOME/pokemon-memory-reader/config.json` (falls back to `~/.config`) |
| macOS | `~/Library/Application Support/pokemon-memory-reader/` | in the data folder |

Contents: `bridges/` (§4.11), `profiles/` (§5.2), `manual-picks.json` (§9.6), `icons/` (the icon pack, §11.9) and `icon-cache/` (§11.9). The program creates `profiles/` and `icons/` empty at startup so the viewer can show their paths.

### 9.2 `config.json`

Plain JSON checked by a Zod schema in `internal/`, with no `$schema` key. The schema is the only definition of the file. JSON was chosen because the program rewrites the file, so comments would be lost in any format.

```json
{
  "configVersion": 1,
  "port": 7425,
  "host": "127.0.0.1",
  "openBrowser": true,
  "adapter": "auto",
  "adapters": {
    "mgba":      { "host": "127.0.0.1", "port": 7426 },
    "retroarch": { "host": "127.0.0.1", "port": 55355 },
    "bizhawk":   { "host": "127.0.0.1", "port": 7427 }
  },
  "pollHz": 20,
  "updateCheck": true,
  "icons": { "mode": "online", "baseUrl": null }
}
```

- `port` and `host` defaults come from `DEFAULT_PORT` and `DEFAULT_HOST` in the API package. `localhost` is avoided because some systems resolve it to `::1` first while the server binds IPv4. Overlay docs use `http://127.0.0.1:7425`. Before `2.0.0-rc.1`, `RELEASING.md` checks that 7425 is not IANA-assigned. If it is, the implementer picks the nearest unassigned port in 7400-7499 and updates [Config file](./tickets/019-config-file.md). The default is frozen from `2.0.0-rc.1` through all of 2.x.
- `adapter` is exactly one of `"auto"`, `"mgba"`, `"retroarch"`, `"bizhawk"`. A pinned adapter turns probing off.
- `adapters` holds each endpoint, so the emulator can run on another machine. Ports are integers 1-65535, and hosts are non-empty strings. `adapters.mgba.host` and `adapters.bizhawk.host` are also the bridge's bind address: IP literals only, no wildcards, and a change needs a bridge reload (§4.1). The schema has no cross-field port checks. A clash shows as a failed connection or a port-in-use error naming the host and port.
- `pollHz`: an out-of-range integer is clamped to 5-60 with a warning, and a non-integer or non-number falls back to 20 with a warning.
- `icons`: see §11.9.
- No log-level setting (`--debug` only) and no profiles-folder setting.
- **What is a setting.** A viewer choice belongs in `config.json` only when it must match across the OBS browser source and the user's normal browser, because each keeps its own localStorage. Icon source qualifies. Everything else, such as "Show unrevealed opponent Pokémon", stays in localStorage with URL overrides.

### 9.3 Flags and precedence

- Flags: `--port <n>`, `--host <addr>`, `--no-browser`, `--data-dir <path>`, `--debug`, `--version`, `--help`.
- `PMR_DATA_DIR` is the only program-specific env var, besides the `XDG_*` variables the Linux defaults follow.
- Precedence: flag > file > built-in default. For the data folder: flag > env > default. Flag values apply to the current run and are never saved.
- `--data-dir`/`PMR_DATA_DIR` moves everything the program reads or writes into one root, `config.json` included, on every OS. The smoke test uses it, and it is how two instances get separate settings. The program creates the folder if missing and exits 1 with a clear message if it can't write there. There is no `--config` flag.
- An unknown flag or an invalid value (such as `--port abc`, or a port outside 1-65535) prints usage to stderr and exits 2. `--help` and `--version` exit 0.
- `--version` prints the version, target and short commit SHA, such as `2.0.0-rc.1 (windows-x64-baseline, a1b2c3d)`. CI injects the version and SHA with `--define`, and a local build prints `dev` in place of the SHA.

### 9.4 When changes apply, and bad files

- Adapter pin and endpoints, `pollHz`, `updateCheck` and icon settings apply live. `port`, `host` and `openBrowser` are read only at startup, and the viewer says "restart to apply".
- Hand edits are read only at startup. Nothing watches the file.
- **Bad or missing file.** The program always keeps running.
  - A missing file means defaults, and nothing is written.
  - Malformed JSON logs an error naming the path, runs on defaults and refuses saves.
  - A key with an invalid value falls back to its default with one warning.
  - Unknown keys warn once and survive saves.
  - A newer `configVersion` runs on the keys it understands and refuses saves.

### 9.5 `/settings` routes

- `GET /settings` and `PUT /settings` sit outside `/api/v2`, carry no stability promise and are not in the API package. Their contract lives in `internal/`.
- `GET` returns each setting's applied value plus its `source` (`"flag"`, `"file"` or `"default"`) and `restartRequired`, and `pending` when the file holds a different value waiting for a restart. It also returns the icon pack path and the icon cache path and size.
- `PUT` takes a partial patch of known keys, checked by the same schema. It can never change `configVersion` or the data folder.
  - The file is created on the first save.
  - Each save re-reads the file, applies the patch, keeps unknown keys, writes a temp file with a per-process unique name in the same folder, and renames it over the original. Instances sharing a folder never clobber each other's unrelated keys, and the last writer wins on the same key. A rare lost update between overlapping saves is accepted, with no lock file.
  - A refused save returns an error code. The viewer shows a banner naming the path and displays the current values read-only.
- `POST /settings/icon-cache/clear` deletes every source folder under `icon-cache/`.
- **Write guards** on `PUT /settings` and `POST /settings/icon-cache/clear`:
  - the socket's peer address is loopback (never `X-Forwarded-For`)
  - `Content-Type` is `application/json`, which forces a CORS preflight the route never approves
  - `Host` is `localhost`, `127.0.0.1`, `[::1]` or the configured bind host, with the port
  - any `Origin` present equals the server's own origin
- LAN clients can read `/settings` but not write it. Each rejection path has a test. These guards close CSRF and DNS-rebinding attacks and stop LAN clients from changing the bind address or adapter endpoints.

### 9.6 Manual picks

- `<data folder>/manual-picks.json`, a program-owned state file kept apart from settings, checked by Zod and saved with the same re-read, merge and atomic-rename rule.
- Keyed `sha1:<hex>` when the hash is known, else `header:<gameCode>:<revision>:<title>`. This conflicts with [Game identification](./tickets/009-game-identification.md), which keys by any hash. See [§17 item 2](#17-conflicts-and-gaps).
- A malformed file is renamed to `manual-picks.json.bad` and replaced with empty state.
- How the viewer lists candidate profiles, makes a pick or forgets one has no route. See [§17 item 9](#17-conflicts-and-gaps).

### 9.7 Console, startup failures and shutdown

- **Startup output.** The version line, the data folder path, the config file path (with "not created yet, using defaults" when missing), then the viewer URL.
- **LAN warning.** When `host` is not loopback, the program warns that the API and viewer are reachable by anyone on the network and that settings stay writable only from this machine. With `0.0.0.0` it prints one URL per non-internal IPv4 interface.
- `--debug` adds detail.
- **Port in use.** The program prints an error naming the port and suggesting `--port`, noting that a second emulator needs its own port, then exits 1. It never falls back to another port.
- **Windows console.** After a fatal startup error, when stdin and stdout are both TTYs, the program prints "Press Enter to close" and waits, then exits with the same code. With no TTY it exits at once. A server test checks that a port conflict exits 1 with no TTY and doesn't wait.
- **Shutdown.** SIGINT, SIGTERM and Ctrl+C on Windows stop the loop, close SSE streams and the adapter, and exit 0 within 2 s. A second signal in that window exits at once with 130. A graceful shutdown that takes longer than 2 s logs the step that hung and exits 1. Server tests cover 130 and 1, and the smoke test asserts exit 0 on one signal.

### 9.8 Update check

- At startup and every 24 hours, the program lists this repo's releases through the GitHub API (`GET /repos/{owner}/{repo}/releases`, which hides drafts). It considers only app tags, `v` plus a semver version, so `api-v*` releases and `v1-lua` never count.
- Version comparison uses real semver ordering (`rc.2` before `rc.10`). A stable build compares only against non-prerelease releases. A prerelease build compares against all of them.
- When a newer version exists, the program prints one console line and the viewer shows a banner linking to the release page, never to an asset. The user downloads by hand.
- The check sends no user data, fails silently when offline or rate-limited, runs after the server is listening and never delays startup. A failed check logs only under `--debug`.
- `updateCheck` (default on) turns it off. Turning it off live cancels the next check, and turning it on schedules one shortly after. The README says the check exists.
- How the viewer learns about an available update has no route. See [§17 item 9](#17-conflicts-and-gaps).

### 9.9 Debug routes

`GET /debug/metrics` exists only under `--debug`. It sits outside `/api/v2`, is read-only, answers loopback peers only, is not in the API package, and carries no stability promise. The raw-read route of §7.1 is also `--debug` only.

## 10. The API package

Sources: [Importable package for overlay developers](./tickets/015-importable-package.md), [Config file](./tickets/019-config-file.md), [Release pipeline](./tickets/017-release-pipeline.md), [License](./tickets/007-license.md), [Decoder test fixtures](./tickets/014-decoder-fixtures.md).

- **What.** One MIT package, `@pokemon-memory-reader/api`, on npm. It ships with v2.0, with release candidates on npm first (§13.8). It is the single source of truth for the public API, and the server, the viewer and outside overlays all import it. No JSR.
- **Name fallback.** The owner claims the `pokemon-memory-reader` npm org before the first release candidate. If it can't be claimed, the package becomes `pokemon-memory-reader-api` and the name is updated in [Importable package](./tickets/015-importable-package.md), the map, [Language and HTTP stack](./tickets/004-language-and-toolkit.md) and [Release pipeline](./tickets/017-release-pipeline.md).
- **Subpaths.**
  - `/types`: inferred TypeScript types, no runtime code.
  - `/schemas`: Zod schemas for every resource, the error body and the SSE events, plus `TOPICS` (a const tuple of topic names, `status` included), a `ResourceMap` type and a `resourceSchemas` record keyed by topic.
  - `/client`: `get` helpers per resource, `subscribe(topics, handlers, options)`, `PmrApiError`, `API_VERSION`, the base path, `DEFAULT_PORT` (7425), `DEFAULT_HOST` (`127.0.0.1`) and `DEFAULT_BASE_URL` (`http://127.0.0.1:7425`). The defaults are fixed within 2.x.
- **Zod.** `zod` major 4 is an optional peerDependency. Users of types and the client never install it.
- **Client options.** `baseUrl` (defaults to `DEFAULT_BASE_URL`), injectable `fetch` and `EventSource`, and `validate` (off by default). With `validate: true`, the client lazy-loads `/schemas` and throws a clear error if Zod is missing.
- **`subscribe`.**
  - Returns `{ close(), readonly connection }`, where `connection` is `"connecting" | "open" | "reconnecting" | "closed"`, and reports changes through `onConnection`. The server's resend of every subscribed topic on connect covers reconnects.
  - It accepts `Topic | (string & {})`. Known topics go to typed handlers. A requested topic the package doesn't know goes to `onUnknown(topic, data)` as `unknown`, never validated, even with `validate: true`.
  - On a `400` at connect it sets `connection` to `closed`, reports a `PmrApiError` of kind `http` through `onError`, and doesn't retry.
- **Errors.** One `PmrApiError` class with `kind`:
  - `unavailable`: the 503 body's `code`, `message` and `status`
  - `http`: another status
  - `network`: the fetch failure as `cause`
  - `invalid`: a failed opt-in validation

  `get` helpers throw it, and `subscribe` passes it to `onError`. Fetching `status` never yields `unavailable`. With validation on, an event that fails it is dropped and reported as `invalid`.
- **Forward compatibility.** Loose schemas and listed open enums (§7.11).
- **Versioning.** Semver major equals the API path version, so 2.x targets `/api/v2`. Minor is an additive API change, patch a fix to the package alone, independent of the app's version. `/api/v3` ships as 3.0.0, and 2.x then gets security fixes only. `2.0.0-rc.N` goes out under `next` and is promoted to `latest` at v2.0 (§13.8).
- **Sync.** The server's snapshot and SSE routes are typed against `TOPICS`, `ResourceMap` and `resourceSchemas`, so a resource added on the server without the package fails typecheck. A server test validates real responses against the package schemas, and a snapshot test of `openapi.json` flags non-additive changes.
- **Viewer.** The viewer uses `/client` for snapshots and SSE, passing its page origin as `baseUrl`. It doesn't use Hono's `hc`.
- **Build.** ESM only, ES2022 target. `tsc` emits JS and `.d.ts` to `dist/` with `.js` relative imports and no bundling. `sideEffects` is `false`. The `exports` map points only at `dist/`, and the sources are `src/types.ts`, `src/schemas.ts` and `src/client.ts`. Workspace consumers read source through the tsconfig alias (§2).
- **Package files.** Its own MIT `LICENSE`, and a `files` whitelist of `dist`, `README.md` and `LICENSE`. The README carries an OBS browser-source example and a CDN `<script type="module">` example.
- **CI.** `bun pm pack`, then `publint` and `attw` on the tarball, and a check that the compiled executable works with `api/dist` absent (§13.2).
- **No fixtures package.** Fixtures stay under `server/test/fixtures/`.

## 11. The viewer and icons

Sources: [Viewer design](./tickets/008-viewer-design.md) (prototype at [assets/008-viewer-prototype/index.html](./assets/008-viewer-prototype/index.html), Variant A), [Battle tracker data model](./tickets/012-battle-tracker-data-model.md), [PC box reading](./tickets/013-pc-boxes.md), [Release pipeline](./tickets/017-release-pipeline.md), [Config file](./tickets/019-config-file.md), [Icon and sprite source](./tickets/016-icon-source.md) (evidence in [its asset](./assets/016-icon-source.md)), [Icon loading and fallbacks](./tickets/021-icon-loading.md) (report in [its asset](./assets/021-icon-loading-report.md)), [Expansion hack data format](./tickets/023-expansion-hack-data-format.md), [ROM hack name tables](./tickets/020-hack-name-tables.md).

### 11.1 Shell

- **Layout.** A collapsible left sidebar with five screens: Party, Battle, Boxes, Trainer & bag, and Settings. It collapses to an icon rail with a toggle.
- **Status block.** At the sidebar's foot: connection state and adapter. It also notes which fields the running generation lacks and which battle fields it lacks.
- **Battle indicator.** A red dot on Battle while a battle is live.
- **Not connected, or no game.** These states replace the screens with an explanatory empty state and an adapter probe list.
- **Update banner.** Shown app-wide when a newer release exists (§9.8).
- **Identification notes.**
  - A header match shows a small note (§5.4).
  - A manual pick after a signature `mismatch` or `unchecked` shows a warning.
  - An expansion ROM shows a refusal naming its version (§5.7).
  - Missing ROM access shows the suggestion of a core that maps ROM (§5.5).
- **Null values.** Fields with null values show `—`. A null name shows `#<id>`.

### 11.2 Connection screen

- The bridge data-folder path with a copy button, a download button per bridge, and steps per emulator (§4.11).
- Reload steps for `unknown_bridge` and `protocol_mismatch`, with older or newer for a mismatch (§4.7).
- The adapter list (§3.3).

### 11.3 Party

- Six cards, one per slot, each with the full detail:
  - sprite, nickname, species and level
  - gender, shiny and status
  - types, ball and HP
  - held item, ability, nature and Hidden Power
  - stats, IVs and EVs
  - moves with type icons and PP
- Empty slots show a placeholder.
- Expanded sidebar: 2 columns. Collapsed sidebar: a denser 3x2 grid that fits the party on one screen.

### 11.4 Battle

- **Active battlers.** Your active Pokémon's full card, a VS, and the opponent's active card (sprite, level, types, status, HP, held item, moves, but no stats). Doubles stack two battler cards on each side.
- **Trainer cards.** One per entry in `trainers` (class, name, battle kind, turn, prize money, Pokémon left, usable items), with `—` for nulls. A null name falls back to the class name, then to "Trainer". Kind, format, modes and turn go on the first trainer card.
- **Wild battles.** A "Wild encounter" header with kind, format, modes and turn, and no trainer card.
- **Opponent party.** A card of tiles with the active one highlighted.
  - "Show unrevealed opponent Pokémon" is off by default. With it off, unrevealed tiles stay in place as `?` tiles with a ball icon and no species, level or HP. The tile count matches the party-size balls the game shows. With it on, they render like revealed tiles.
  - The setting is stored in localStorage. `?showUnrevealed=1` or `=0` overrides it for one page load without writing to storage, for OBS browser sources.
- **Pokémon left.** Derived per trainer from `opponent.party` as the count with HP above 0, revealed or not.
- **Field.** Conditions show only as badges for active effects. `none` and `null` are hidden.
- **No battle.** An empty state, plus a one-line "Last battle" summary when `lastBattle` is non-null.

### 11.5 Boxes

- A box selector and a grid in slot order: 5×4 for Gen 1-2, 6×5 for Gen 3.
- Clicking a slot opens the Pokémon card, which shows `null` fields as `—`.
- An unreadable box shows a short note, and corrupt slots get a distinct marker. A note explains Gen 1-2 staleness and missing SRAM access.
- The screen subscribes to `boxes` only while it is open.
- No search or filtering in v2.0.

### 11.6 Trainer & bag

Player details with an eight-badge row, and the bag by pocket with item icons. Gen 2 has 16 badges, which an eight-badge row doesn't fit ([§17 item 5](#17-conflicts-and-gaps)).

### 11.7 Settings and About

- **Fields.** Adapter pin and list, port, bind address with a LAN warning, open-browser toggle, and the icon section (§11.9). `PUT /settings` accepts every config key (§9.5), but no ticket says whether Settings also shows the adapter endpoints, `pollHz` or `updateCheck` ([§17 item 9](#17-conflicts-and-gaps)).
- **Field state.** Each field shows its source. Fields a flag overrides are disabled. Port, host and open-browser are marked "restart to apply". Changing `port` warns that overlays using `DEFAULT_BASE_URL` will need the new URL.
- **Paths.** The config file path and the profiles folder path.
- **Refused saves.** A banner names the file when saves are refused.
- **About.** Settings or an About page shows the version string and `THIRD-PARTY-NOTICES.txt`. The routes that serve them are open ([§17 item 9](#17-conflicts-and-gaps)).

### 11.8 Styling

- Tailwind, dark theme, rounded cards on a dark slate surface.
- HP bars turn green, amber, red and grey.
- Type colours for fallback dots and tiles.
- Status conditions are short text badges, with no icon art.
- Types, items, balls and Pokémon use icons with the name beside them.

### 11.9 Icons

**Source and fetch path.**

- The viewer loads images only from the program's `/icons/...` route. Nothing is bundled.
- For each file the program checks the icon pack, then `<data folder>/icon-cache/`, then upstream when `mode` is `"online"`. The OBS source and the normal browser share one fetch, and icons keep working offline once fetched.
- **Upstream.** `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@<sha>`, pinned to a commit SHA held as a constant in `server/`. The first pin is `1b3b7c0a538dd2226ae08d0d2f8955125075bbd4` (2026-11-03). If `check-icon-map` reports misses at that SHA, the implementer fixes the mapping tables or pins a newer SHA where it passes.
- **Why this source.** PokeAPI/sprites is CC0 as a repository but marks the images "Copyright The Pokémon Company", so use is tolerated, not licensed. It sets no hotlink terms. `@master` was rejected because an upstream rename would break shipped builds. raw.githubusercontent.com was rejected because GitHub doesn't offer it as a CDN, caches it for 5 minutes and throttles heavy use.

**Art per screen.**

- Party cards and both battlers use the static front sprite from `pokemon/versions/<generation>/<artVersion>/`.
  - Gen 1-2 use the folder's `transparent/` subfolder where it has one. `red-green-japan` has none and uses the base folder.
  - Shiny Pokémon use `shiny/` in Gen 3 and `transparent/shiny/` in Gen 2.
  - Gen 1 never requests a shiny sprite, and such a request returns `404`.
  - Nothing is animated, and no back sprites are used.
- The Boxes grid and opponent party tiles use Gen 3 menu icons, `pokemon/versions/generation-iii/icons/<dex>.png`, for all three generations, with no shiny variant. They cover dex 1-386, so they include every Gen 1-2 species. No source has Gen 1-2 box icons.
- **Types.** Gen 3 type icons come from the running version's folder under `types/generation-iii/`. Gen 1-2 use `types/generation-iii/firered-leafgreen/`. The ??? type maps to PokeAPI type `10001`.
- **Items and balls** use `items/<slug>.png` in every generation.

**Routes.**

| Route | Use |
|---|---|
| `GET /icons/{profileId}/pokemon/{speciesId}` | Card sprite |
| `GET /icons/{profileId}/pokemon/{speciesId}/shiny` | Shiny card sprite |
| `GET /icons/{profileId}/icon/{speciesId}` | Menu icon |
| `GET /icons/{profileId}/item/{itemId}` | Items and balls |
| `GET /icons/{profileId}/type/{typeName}` | Type icon |

- The viewer builds URLs from the profile ID in `status` and the IDs the API already sends, so the public API doesn't change. The program resolves art version, generation and profile kind from the profile ID, so a URL never changes meaning when the game changes. With no identified game, the viewer makes no icon requests.
- **Key grammar.**
  - `profileId` equals a loaded profile's ID exactly, matches `[A-Za-z0-9._-]+`, and is not `.` or `..`.
  - `speciesId` and `itemId` are decimal integers 0-65535 with no leading zeros.
  - `typeName` is one of the API's type enum values, URL-encoded, including ???. The type enum is not yet defined and would be closed under §7.11 ([§17 item 4](#17-conflicts-and-gaps)).
  - `shiny` is valid only on `pokemon` routes.
  - Anything else returns `404`, and a unit test covers the grammar.

**ID mapping.**

- Dev-time tables checked into `server/`: internal species ID to dex from each data format's reference data, item ID to PokeAPI slug for Gen 1-3 (one table per `artVersion`), and type name to PokeAPI type ID.
- The item generator uses PokeAPI's item data, such as `item_game_indices`, and falls back to matching English names where that data lacks a generation's index.
- An unmapped ID returns `404`. A unit test checks the tables' shape. The viewer never slugifies names.

**Hack profiles.**

- A species gets upstream art only when its internal ID is a vanilla Gen 3 species ID (1-251 or 277-411), with its dex from the vanilla table.
- An item gets upstream art only when its ID is mapped in the item table for the hack's `artVersion`.
- Other IDs are looked up only in the pack's `hack/{profileId}/` folder, never upstream.

**Icon pack** in `<data folder>/icons/`:

```
icons/
  pokemon/{artVersion}/{dex}.png
  pokemon/{artVersion}/shiny/{dex}.png
  icon/{dex}.png
  item/{itemSlug}.png
  type/{typeArtVersion}/{typeName}.png
  hack/{profileId}/pokemon/{speciesId}.png
  hack/{profileId}/pokemon/shiny/{speciesId}.png
  hack/{profileId}/icon/{speciesId}.png
  hack/{profileId}/item/{itemId}.png
```

- `typeArtVersion` is the folder the type icon resolved to, so `firered-leafgreen` for Gen 1-2. The ??? type is written `unknown` in pack paths, because `?` is not a legal Windows filename character.
- A repo doc describes the layout, and Settings links to it. The folder is never watched.
- **Lookup order.**
  - Hack profile: `hack/{profileId}/...` first. For vanilla-set IDs, then the normal pack path, cache and upstream. Outside the vanilla set, lookup stops after the hack folder.
  - Official profile: normal pack path, cache, upstream.

**Mirror and cache.**

- `icons.baseUrl` can point at any mirror of the PokeAPI/sprites tree (the folder that contains `sprites/`) and replaces the default. Mirrors are trusted, not checked.
- Cache files live in `<data folder>/icon-cache/<sourceId>/` under their upstream path. `sourceId` is `pokeapi-<sha>` for the default and `mirror-<first 12 hex of sha256(baseUrl)>` for a mirror. The source in use is the one the current `baseUrl` resolves to, whatever the `mode`.
- Files never expire and have no size cap.
- At startup the program deletes every cache folder except the source in use. A live `baseUrl` change leaves the old folder until the next startup.
- Writes go to a temp file and are renamed into place. Upstream `404`s are remembered in memory for the run.

**Route rules.**

- Upstream fetches time out after 5 s, at most 4 run at once, and parallel requests for one key share one fetch. A network error, as opposed to a `404`, backs off that source for 60 s.
- The program serves only PNGs that pass a magic-byte check and are 512 KB or smaller.
  - A failing pack file logs one warning per run and is treated as absent.
  - A failing cached file is deleted and fetched again.
  - A failing upstream response isn't cached, returns `404` and is remembered for the run.
- Responses carry `Content-Type: image/png`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-cache` and an ETag of the content hash. Browsers revalidate on each load and get `304`s, so pack edits, mode changes and cache clears show on the next reload.
- Any non-2xx makes the viewer show the fallback until the key changes or the page reloads.

**Fallbacks** (also used when `mode` is `"off"`):

- A Pokémon shows a rounded tile at sprite size, tinted with its primary type colour, with the name's first letter or `#<id>`.
- An item or ball shows its name or `#<id>`.
- A type shows a badge in its colour with its name.

**Config.**

- `"icons": { "mode": "online" | "local" | "off", "baseUrl": null }`:
  - `"online"`: pack, cache, then upstream.
  - `"local"`: pack only, with no network requests.
  - `"off"`: no images. The viewer makes no requests, and the route returns `404`.
- `baseUrl` is `null` (the pinned default) or an `http` or `https` URL, with a trailing slash dropped. Invalid values fall back with one warning. Both keys apply live.

**Scope.** `/icons` sits outside `/api/v2`, carries no stability promise, isn't in the API package, and answers any client that can reach the viewer, LAN included. The README says overlays may use it at their own risk.

**Settings section.**

- A mode select (Online, Local pack only, Off).
- A mirror URL field, where empty means the default.
- The pack folder path with a copy button and a link to the layout doc.
- The cache size with a "Clear icon cache" button.
- An art credit: © The Pokémon Company, loaded from PokeAPI/sprites, not bundled.

**Coverage check.** A dev-time `check-icon-map` script sends a HEAD request for every mapped upstream path at the pinned SHA and lists misses. `RELEASING.md` runs it whenever the SHA changes and blocks the release until it passes. CI stays offline.

## 12. Fixtures and the coverage gate

Sources: [Decoder test fixtures](./tickets/014-decoder-fixtures.md), [License](./tickets/007-license.md), [PC box reading](./tickets/013-pc-boxes.md), [Battle tracker data model](./tickets/012-battle-tracker-data-model.md), [Expansion hack data format](./tickets/023-expansion-hack-data-format.md), [Hack species data](./tickets/024-hack-species-data.md), [Importable package](./tickets/015-importable-package.md).

### 12.1 Fixture files

- `<state-slug>.fixture.json`, checked by a Zod schema.
- **Metadata.** Profile ID, data format, emulator and version, adapter name, capture tool version, capture date, `anonymized`, and a free-text description of the in-game state.
- **Regions.** `regions: [{ domain, offset, length, sha256, bytes }]`, with `bytes` in base64. The sha256 shows whether a recapture changed the bytes or only the format. Regions use logical domains (§3.2), never emulator addresses.
- **Layout.** `server/test/fixtures/<profile-id>/<state-slug>.fixture.json`, with `.expected.json` and `.sequence.json` beside it. Slugs are kebab-case and describe the state, such as `trainer-battle-turn1`. There is no data-format folder.
- **Size.** A default-suite test caps a fixture at 256 KB and a sequence file at 1 MB. No Git LFS.
- **Privacy.** Fixtures may carry the owner's trainer name and IDs unless captured with `--anonymize`.

### 12.2 No ROM bytes

- No fixture holds ROM data. Savestates and full RAM dumps stay local and gitignored.
- Decoders that read ROM tables (trainers, trainer class names, the money table, hack name and species tables) and header identification are tested on synthetic buffers built in the test, plus optional `test:local` tests against the owner's ROM. Those have no real-data golden, and the docs say so.
- In fixture tests the profile's ROM tables count as missing, so dependent fields decode to null. Goldens record those nulls, and such fields never go on a `verified` list.

### 12.3 `SliceAdapter`

In tests, a `SliceAdapter` implements the adapter interface over a fixture and throws on any read outside a recorded region. A decoder that reads undeclared memory fails loudly.

### 12.4 Capture tool

- `bun run fixture:capture <profile-id> <state-slug>` connects through the real adapter, resolves the declared regions from the profile (the union for the requested resources, pointer words included), reads them, and writes the fixture plus a draft golden. The owner loads a savestate first.
- **Flags.**
  - `--from-dump <domain>=<file>` takes flat per-domain dumps instead of a live emulator.
  - `--append` adds a frame to a sequence fixture.
  - `--anonymize` overwrites the player name, OT names and trainer ID bytes and sets `anonymized: true`. The golden is written after anonymizing. In Gen 3 it picks a new trainer ID and secret ID whose XOR equals the original, so shininess holds, then fixes each mon's checksum. Gen 1-2 SRAM save checksums are left as they are.
- Rewritten fields never go on a `verified` list. Fixtures that prove checksum, shiny or gender behaviour are not anonymized.
- Savestate files are not parsed.
- When practical, one state is also captured on a second emulator and the bytes compared, to catch adapter bugs baked into fixtures.

### 12.5 Golden files

- The capture tool writes `<state-slug>.expected.draft.json`. Only the owner promotes it to `<state-slug>.expected.json`, after checking it against the game. The coverage guard fails if a draft is committed.
- The golden holds the decoded resources and a `verified` list of fields the owner confirmed on the in-game screens.
- Tests compare with deep equality. An agent never regenerates a golden without a human-reviewed diff. Bun snapshots are not used. Targeted assertions cover facts a golden can't express.
- **Sequence fixtures.** `<slug>.sequence.json` holds ordered `frames` with the expected state per frame. They cover an intro frame that doesn't validate followed by a valid frame, the last in-battle frame followed by the post-battle frame, and Gen 1 `wIsInBattle == 0xFF`. The invalid intro frame may be made by mutating a real frame.
- **Synthetic mutations.** Helpers mutate real slices. They re-encode a Gen 3 mon under a different personality value to cover all 24 substructure orders, flip a checksum byte, set the bad-egg flag, and write an invalid species into a Gen 1-2 box slot.
  - A self-check proves the re-encoder: re-encoding a real mon under its own personality value reproduces the original bytes.
  - Helpers never write fixture files and always start from a real slice. A from-scratch test encoder was rejected.

### 12.6 Primary revisions

- **Full matrix:** Gen 1 `red-us-1.0`; Gen 2 `crystal-us-1.1`; Gen 3 `emerald-us-1.0`, `firered-us-1.0` and `ruby-us-1.0`; CFRU `radical-red-4.1`.
- Every other revision the owner owns gets a smoke fixture (party and player) that checks its generated addresses and charmap. Yellow is smoke-only.
- A language counts as supported only after it has a smoke fixture.

### 12.7 Coverage matrix

`server/test/fixtures/coverage.ts` lists the required states per data format, each tagged `tier: 1 | 2` and naming the fields its golden must verify. ROM-derived and anonymized fields are never named.

- **Tier 1:**
  - new game with an empty party
  - a full party of 6 with a status condition
  - a nickname with special characters
  - a bag with every pocket non-empty
  - player data: money, badges, name, play time
  - boxes: Gen 3 storage with several boxes filled, or the Gen 1-2 current box plus at least one non-current SRAM box
  - a wild single battle on turn 1
  - a trainer single battle on turn 1 with a partly revealed party
- **Tier 2:**
  - an egg (Gen 2-3)
  - a Gen 1-2 capture after switching box without saving
  - a Gen 3 and CFRU trainer double battle
  - the battle intro frame that doesn't validate
  - every verification fixture below
- **Verification fixtures,** tagged `proves: "<fact>"` with a targeted assertion:
  - the Gen 1-2 `wEnemyMon` DV read
  - an Emerald multi or in-game-partner battle (whether partner mons sit in player party memory)
  - a double battle with a partner
  - a turn counter address per generation
  - each `modes` value
  - the Gen 1-2 prize formulas against `wAmountMoneyWon` and `wBattleReward` after a win
  - the Gen 1-2 `wBattleResult` mask and mapping against won, lost, drew, ran and caught savestates

  Until each lands, its field keeps the fallback in §7.8. A mode that can't be captured is dropped from the v2.0 enum.
- **Hack species checks.** A boxed-mon fixture confirms CFRU box leveling (§5.6).
- **Contradictions found by fixtures.** An internal correction, such as a different mask or address, is fixed in code and noted in the fixture's description. A finding that changes a public field's shape or meaning stops the implementer, who files a ticket amending the battle or API contract with the fixture slug as evidence. The field keeps its fallback until that ticket resolves.

### 12.8 The guard and the support gate

- **Coverage guard.** A default-suite test fails when a tier 1 state is missing for any primary revision of a supported format, a tier 1 golden's `verified` list lacks a named field, a fixture has no golden, or a draft golden is committed. It prints a stable sorted list of tier 2 gaps and profiles with no fixture. Tier 2 gaps never fail the suite.
- **Support gate.** A data format's `supported` flag may be true only when its tier 1 states pass with their fields verified on every primary revision.
- **Profile coverage.** Each profile's `fixture: "full" | "smoke" | "none"` is checked against the fixture folder. The API gains no coverage field, since `match` already says how sure identification is. An additive `status.game.verified` can follow if users ask. The docs list profile coverage from the same data.
- **Hack boxes.** For CFRU and other hacks, `features.boxes` stays false until that profile has a box fixture.

### 12.9 Running tests

- `bun test` and CI read only committed fixtures and synthetic buffers.
- Tests that need the owner's savestates, dumps or ROM run under `bun run test:local`. It reads paths from env vars, never runs in CI, and keeps local files in a gitignored `fixtures-local/`.
  - An unset env var prints a clear "not run" line.
  - A set env var pointing to a missing file fails the test.
  - `test:local` also checks each official profile's signature against the owner's ROMs (§5.4).

## 13. Release pipeline and CI

Sources: [Release pipeline](./tickets/017-release-pipeline.md), [Importable package](./tickets/015-importable-package.md), [Decoder test fixtures](./tickets/014-decoder-fixtures.md), [Icon loading and fallbacks](./tickets/021-icon-loading.md), [Bridge wire protocol](./tickets/022-bridge-wire-protocol.md), [Config file](./tickets/019-config-file.md), and the build map's [Emulator Lua runtimes](../v2-build/tickets/003-emulator-lua-runtimes.md).

### 13.1 Targets and builds

- **Targets.** `bun-windows-x64-baseline`, `bun-linux-x64-baseline`, `bun-darwin-x64-baseline`, `bun-linux-arm64`, `bun-darwin-arm64` and `bun-windows-arm64`. x64 uses the baseline variant because the default crashes on CPUs without AVX2. Windows and Linux x64 are supported, and the rest are best effort. Bun 1.4.2 compiled all six from Linux. The implementer confirms the list against `bun build --help` for the pinned Bun.
- **Build runners.** An ubuntu runner compiles Windows and Linux. A macOS arm runner compiles both macOS targets and ad-hoc signs them with `codesign --sign -`, with no hardened runtime and no JIT entitlements.
- **Smoke runners.** Each archive is smoke-tested on its native runner: `windows-latest`, `windows-11-arm`, `ubuntu-latest`, `ubuntu-24.04-arm` and `macos-latest`. darwin-x64 runs under Rosetta 2 (`arch -x86_64`), installed with `softwareupdate --install-rosetta --agree-to-license` if missing.
  - The implementer confirms the arm runners are free for this public repo. A target without a runner is marked untested in the release notes, and the notes say darwin-x64 was tested under Rosetta only.
  - Smoke jobs test the exact archives the release uploads, never rebuilds.

### 13.2 PR CI (`ci.yml`)

Runs on push and pull request:

- frozen install
- Biome
- `tsc --noEmit`
- `bun test`, coverage guard included
- the API package check: `bun pm pack`, then `publint` and `attw` on the tarball
- a linux-x64 compile with `api/dist` absent, followed by the smoke script

CI also runs the Lua protocol core under stock Lua 5.4 with a fake shim against TypeScript-generated test vectors, and checks that the Lua and TypeScript protocol constants match (§4.9). Per [Emulator Lua runtimes](../v2-build/tickets/003-emulator-lua-runtimes.md), Lua comes from `leafo/gh-actions-lua`. The license check of §13.5 also fails CI.

GitHub Actions are pinned by commit SHA, and Dependabot updates them. A Bun upgrade goes through a PR that runs the full release smoke matrix.

### 13.3 Smoke script

`scripts/smoke.ts <executable> <expected-version>` runs in PR CI on linux-x64 and in every release smoke job. Release jobs pass the version from the tag, and PR CI passes `server/package.json`'s version.

- The semver part of `--version` must equal the expected version.
- The executable starts with `--no-browser` on a free port picked by the script, with its data folder pointed at a fresh temp directory.
- `GET /api/v2/status` must return state `disconnected`, and `GET /` must return the viewer HTML.
- `GET /bridges/mgba.lua` and `GET /bridges/bizhawk.lua` must return 200, and both files must exist in the temp data folder.
- Linux and macOS send SIGTERM and require exit 0. Windows ends the process with `taskkill /F` in a `finally` step and doesn't check the exit code.
- No test-only flag ships in the product.

### 13.4 Archives, signing and notes

- **Archives.** `pokemon-memory-reader-v<version>-<os>-<arch>.<ext>`: `.zip` for Windows and macOS, `.tar.gz` for Linux so the executable bit survives. Each holds the executable, `LICENSE`, `README.md` and `THIRD-PARTY-NOTICES.txt`. Every release carries `SHA256SUMS`.
- **Signing.** Unsigned on Windows, ad-hoc signed and not notarized on macOS.
- **User notes.** The README and every release body give:
  - the SmartScreen step (More info, then Run anyway), also for Windows arm64
  - the macOS step `xattr -d com.apple.quarantine <file>`
  - a note that antivirus tools sometimes flag Bun-compiled executables. The owner submits a flagged release to Microsoft's false-positive portal.

### 13.5 Third-party notices

- `scripts/notices.ts` walks the production dependency closure of `server/` and `viewer/`, adds Bun's runtime license and its bundled components, and adds fonts and other assets the viewer bundles. It writes `THIRD-PARTY-NOTICES.txt` with each license text.
- CI fails on a missing license or one outside a GPL-3.0-compatible allowlist (MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD "and similar"). An `OR` expression passes if one option is allowed. The full list is not set ([§17 item 15](#17-conflicts-and-gaps)).
- The viewer's About page serves the same file.

### 13.6 Versions, tags and channels

- **Tags.** App tags are `v<semver>` and package tags `api-v<semver>`, each with its own workflow. `release.yml` triggers on `v[0-9]+.[0-9]+.[0-9]+*`, so `v1-lua` never starts it, and it checks that the tag parses as semver.
- **Version source.** The app version lives in `server/package.json`. The workflow fails if the tag doesn't match it, or if the tagged commit isn't reachable from `origin/main`. This conflicts with the build map's rule that main stays untouched until the final release ticket ([§17 item 12](#17-conflicts-and-gaps)).
- **Changelogs.** `CHANGELOG.md` covers the app and `api/CHANGELOG.md` the package, both written by hand. The release body comes from the matching section.
- **Channels.** The semver prerelease suffix is the channel. A GitHub release is marked prerelease exactly when its tag contains `-`.

### 13.7 Draft releases and `RELEASING.md`

- `release.yml` builds, signs the macOS targets, smoke-tests, and creates a draft release holding the archives, the `.lua` files and `SHA256SUMS`. It pastes the coverage guard's tier 2 and no-fixture list into the draft body.
- The owner publishes the draft after the checklist, so the update check never sees an unreviewed build.
- A pushed tag is never moved or deleted. If the checklist fails, the owner deletes only the draft, the fix lands, and the next RC or patch is cut.
- **`RELEASING.md` checklist,** for v2.0 and every RC:
  - review the tier 2 and no-fixture list
  - confirm every smoke job is green, including the baseline, arm and Rosetta jobs
  - write the changelog section
  - check that the release body carries the SmartScreen, quarantine, antivirus, best-effort and Rosetta-only notes
  - hand-test Ctrl+C shutdown on Windows
  - run the manual bridge smoke check per emulator (§4.9)
  - run `check-icon-map` whenever the pinned sprites SHA changed, and block until it passes
  - for an API release, confirm the npm trusted publisher is configured
- **Before `2.0.0-rc.1` only:** the npm org is claimed, the `DEFAULT_BASE_URL` constants are settled, and 7425 is confirmed not IANA-assigned (§9.2).

### 13.8 npm publishing

- `release-api.yml`, triggered by `api-v*` tags, publishes `@pokemon-memory-reader/api` through npm trusted publishing (GitHub OIDC) with provenance and no long-lived token. It uses the npm CLI 11.5.1 or later, because older npm and `bun publish` can't publish through OIDC.
- **Dist-tags.** A prerelease version goes to `next` and a stable one to `latest`, so publishing `2.0.0` is the promotion. Any other dist-tag change is an owner-run `npm dist-tag` with 2FA, described in `RELEASING.md`.
- **Releases.** Each `api-v*` tag also creates a GitHub release from the matching `api/CHANGELOG.md` section, marked prerelease when the tag contains `-`.
- **First-time setup.** Trusted publishing needs the package to exist, so an owner-run `wizard.sh` claims the org, publishes a placeholder `0.0.0` by hand and deprecates it with "use @next until 2.0.0", then configures the trusted publisher for `release-api.yml`. `latest` points at the deprecated `0.0.0` until v2.0, and the wizard says so. Every real version, `2.0.0-rc.1` included, goes out through OIDC.
- The workflow filename is part of the trust config and never changes.

### 13.9 v1

- The v1 Lua script is tagged `v1-lua` before any v2 code lands. v1 GitHub releases stay up with legacy notes.
- There is no long-lived v1 branch. [Release pipeline](./tickets/017-release-pipeline.md) has v2 development merge to main, which conflicts with the build map ([§17 item 12](#17-conflicts-and-gaps)).

## 14. Licensing

Sources: [License](./tickets/007-license.md), [What decomp symbol data provides](./tickets/002-decomp-symbol-data.md), [Importable package](./tickets/015-importable-package.md), [Release pipeline](./tickets/017-release-pipeline.md), [ROM hack name tables](./tickets/020-hack-name-tables.md), [Icon and sprite source](./tickets/016-icon-source.md), [Icon loading and fallbacks](./tickets/021-icon-loading.md).

- **App license.** v2 ships under GPL-3.0-or-later. As [License](./tickets/007-license.md) states in its question, v1's license combined GPL-3.0 with Creative Commons NonCommercial terms, which conflict because GPL-3.0 forbids extra restrictions. v2 drops the NonCommercial terms, and the owner, as sole author, needs no one else's consent.
  - GPL stops closed forks.
  - NonCommercial licenses were rejected because monetized streams would sit in a gray area.
  - Overlays that only call the HTTP API are separate programs and can use any license.
- **Packages.** Any workspace package meant for import by outside code ships under MIT with its own `LICENSE`. In v2.0 that is only `@pokemon-memory-reader/api`. The GPL server importing the MIT package is compatible.
- **Markers.** Each package has one SPDX ID in its `package.json` `license` field. The repo root holds `LICENSE` and `NOTICE`. Source files carry no per-file headers.
- **pret-derived data.** No pret repo has a license file. Addresses and struct field offsets count as facts. Generated profiles keep their provenance block, and `NOTICE` credits pret. No pret C or assembly source is copied into the repo.
- **CFRU and hack profiles.** Embedded like other built-in profiles on the same reasoning, and `NOTICE` credits CFRU. A profile is removed if its hack's author objects. Hack profiles declare table locations, never names or species data (§5.5, §5.6).
- **Nintendo content.** The repo and executable bundle names and numeric reference data but no sprites, artwork or audio.
  - The README says the project is not affiliated with Nintendo, Game Freak or The Pokémon Company.
  - Icons load at runtime from PokeAPI/sprites under tolerated use, and the Settings credit says so (§11.9).
- **Fixtures.** Only trimmed RAM slices are committed, never ROM bytes, savestates or full dumps (§12).
- **Third-party notices.** Checked against a GPL-compatible allowlist (§13.5).
- **v1.** The `v1-lua` tag stays untouched. The v2 README states that v1 was released under the GPL-3.0 text in its `LICENSE` file.

## 15. Implementation spikes and checks

Sources: [Read loop and latency budget](./tickets/018-read-loop.md), [Bridge wire protocol](./tickets/022-bridge-wire-protocol.md), [PC box reading](./tickets/013-pc-boxes.md), [Hack species data](./tickets/024-hack-species-data.md), [ROM hack name tables](./tickets/020-hack-name-tables.md), [Expansion hack data format](./tickets/023-expansion-hack-data-format.md), [Release pipeline](./tickets/017-release-pipeline.md), [Config file](./tickets/019-config-file.md), [Icon loading and fallbacks](./tickets/021-icon-loading.md), [Emulator memory access APIs](./tickets/001-emulator-memory-access.md).

These are open for implementation, not for the spec. Each either has a fallback decided or is a check the implementer runs before writing the affected code.

| Item | Owner section | Fallback or rule |
|---|---|---|
| Bridge spike items | §4.12 | Fallbacks in that table |
| Do paused mGBA, BizHawk and RetroArch stop replying? | §8.6 | The program relies on neither behaviour |
| Does RetroArch handle one command or all pending commands per poll? | §3.4, §8.9 | If one per frame, N ranges cost N frames, and the budget holds only with a larger merge gap. Measure in the RetroArch adapter spike, which may set `minIntervalMs` |
| RetroArch reply format echoes the address | §3.4 | Confirmed by the RetroArch adapter spike |
| Gen 2 box names, name length and charmap, and the absence of Gen 1 names and Gen 2 wallpapers | §6.5 | Verify against pret before implementing |
| 0x1C species-info stride for Gen 3 and CFRU | §5.6 | Confirm before either decoder ships ([§17 item 11](#17-conflicts-and-gaps)) |
| CFRU levels box mons with `GetLevelFromBoxMonExp` | §5.6 | A boxed-mon fixture confirms it |
| 90% name and species table constants, `MAX_NATIONAL_DEX` | §5.5, §5.6 | Recheck against a real hack ROM |
| Signature catches CFRU and expansion hacks | §5.4 | A `test:local` run against the owner's hack ROMs |
| `RHHEXP` block offset near `0x08000200` | §5.7 | The scan covers `0x08000100`-`0x08000400` |
| Bun target list for the pinned Bun | §13.1 | Confirm against `bun build --help` |
| Free arm runners for this repo | §13.1 | Mark the target untested in release notes |
| mGBA 0.11 ships `--script` | §4.11 | Check the release before writing the note |
| Port 7425 not IANA-assigned | §9.2 | Nearest unassigned port in 7400-7499 |
| Pinned sprites SHA passes `check-icon-map` | §11.9 | Fix the mapping tables or pin a newer SHA |

## 16. Decision index

Sources: the Decisions so far list of the [rebuild map](./map.md). This is an index, not a subsystem section.

Every line of the rebuild map's Decisions so far, with the sections that carry it.

| Decision | Sections |
|---|---|
| [Emulator memory access APIs](./tickets/001-emulator-memory-access.md) | §1, §3.1, §3.4, §4.11 |
| [What decomp symbol data provides](./tickets/002-decomp-symbol-data.md) | §5.3, §6.1, §14 |
| [App form factor](./tickets/003-app-form-factor.md) | §1, §3.3, §9.2 |
| [Language and HTTP stack](./tickets/004-language-and-toolkit.md) | §2 |
| [Game profile source and format](./tickets/005-game-profile-source.md) | §5.1, §5.2, §5.3, §6.1, §6.2 |
| [API v2 contract](./tickets/006-api-contract.md) | §6.3, §7 |
| [License](./tickets/007-license.md) | §12.2, §14 |
| [Viewer design](./tickets/008-viewer-design.md) | §11.1-§11.8 |
| [Game identification](./tickets/009-game-identification.md) | §5.4, §7.2, §7.4 |
| [How ROM hacks extend reference data](./tickets/010-hack-reference-data.md) | §5.5 |
| [What battle state is readable](./tickets/011-battle-state-readability.md) | §6.4, §7.8 |
| [Battle tracker data model](./tickets/012-battle-tracker-data-model.md) | §7.8, §11.4, §12.7 |
| [Icon and sprite source](./tickets/016-icon-source.md) | §11.9, §14 |
| [PC box reading](./tickets/013-pc-boxes.md) | §6.5, §7.4, §7.9, §8.3, §11.5 |
| [Decoder test fixtures](./tickets/014-decoder-fixtures.md) | §6.1, §12 |
| [Importable package for overlay developers](./tickets/015-importable-package.md) | §2, §7.11, §10 |
| [Release pipeline](./tickets/017-release-pipeline.md) | §4.11, §9.8, §13 |
| [Read loop and latency budget](./tickets/018-read-loop.md) | §8 |
| [Config file](./tickets/019-config-file.md) | §9 |
| [ROM hack name tables](./tickets/020-hack-name-tables.md) | §5.1, §5.5, §7.5 |
| [Icon loading and fallbacks](./tickets/021-icon-loading.md) | §5.1, §9.2, §11.9 |
| [Bridge wire protocol](./tickets/022-bridge-wire-protocol.md) | §3.2, §4, §7.4, §8.5 |
| [Expansion hack data format](./tickets/023-expansion-hack-data-format.md) | §5.3, §5.4, §5.7 |
| [Hack species data](./tickets/024-hack-species-data.md) | §5.6, §7.5 |

## 17. Conflicts and gaps

Sources: all 24 tickets, as linked per item. This section lists open questions and decides none.

Each item names a contradiction between tickets or a point a build slice needs that no ticket decided. None is resolved here. Each is a candidate grilling ticket. "Needed by" names the build-map tickets or fog items that wait on it.

1. **How do profiles write addresses?** (conflict). [Game profile source and format](./tickets/005-game-profile-source.md), [ROM hack name tables](./tickets/020-hack-name-tables.md), [Expansion hack data format](./tickets/023-expansion-hack-data-format.md) and [Hack species data](./tickets/024-hack-species-data.md) write profile addresses as GBA bus addresses (`"0x02024284"`, `{ "ptr": "0x08000144" }`, cartridge space `0x08000000`-`0x09FFFFFF`). [Bridge wire protocol](./tickets/022-bridge-wire-protocol.md) says decoders, profiles and fixtures use domain names plus offsets, and [Decoder test fixtures](./tickets/014-decoder-fixtures.md) declares reads as `{ domain, offset, length }`. No ticket says how a profile writes a GB banked address (pret's `bank:address`, such as WRAM banks or SRAM box banks), or how the program maps a pointer value read from memory (a bus address) to a domain and offset. Needed by: Core module interfaces, Emerald profile and generator, mGBA bridge and adapter.
2. **How are ROMs keyed and re-identified?** (conflict and gap).
   - [Game identification](./tickets/009-game-identification.md) remembers manual picks by hash, but [Config file](./tickets/019-config-file.md) keys them `sha1:` only, else by header. The mGBA bridge sends only `crc32` ([Bridge wire protocol](./tickets/022-bridge-wire-protocol.md)), so picks on the top-priority adapter are header-keyed, and two hacks that share a base header share one pick.
   - GB ROMs have no game code, and the header key omits the global checksum.
   - RetroArch's gpSP core gives no ROM and, on RetroArch master, no hash, so a ROM there can be neither identified nor keyed.
   - The header re-read interval ("about 2 s") was left to [Read loop and latency budget](./tickets/018-read-loop.md), which didn't set it. It also doesn't say whether bridge adapters, which send game messages, run the timer too.

   Needed by: Tracer API (header timer), full identification, RetroArch adapter.
3. **Is `battle.modes` an open enum?** (conflict). [Battle tracker data model](./tickets/012-battle-tracker-data-model.md) and [Decoder test fixtures](./tickets/014-decoder-fixtures.md) add modes "later without a breaking change". [Importable package](./tickets/015-importable-package.md) lists the only open enums (error `code`, `dataFormat`, adapter `id`, topic names, plus `problem` and `bridge.bridge` from [Bridge wire protocol](./tickets/022-bridge-wire-protocol.md)) and says every other enum is closed and never gains a value within `/api/v2`, with a test that fails if one changes. Needed by: the battle resource (rest of Gen 3), the API package.
4. **What is the full Pokémon schema?** (conflict and gap). [API v2 contract](./tickets/006-api-contract.md) names some fields, and later tickets mention others (nickname, OT name and ID, an egg marker, types, ball, PP), but no ticket lists the whole schema.
   - Open: field names and types, including the egg marker, ball, experience, friendship and Pokérus; whether party Pokémon carry `types`; party move fields (`pp`, `maxPp`, and the move type the viewer needs for type icons); the status-condition enum; the nature representation.
   - The type enum is undefined, including ??? and hack types such as Fairy. It would be closed under §7.11, and the icon route keys on it.
   - Gen 1 `shiny` is contradictory: [API v2 contract](./tickets/006-api-contract.md) makes `shiny` a boolean on every Pokémon with no Gen 1 exception, [Decoder test fixtures](./tickets/014-decoder-fixtures.md) says Gen 1-2 shininess comes from DVs, and [Icon loading and fallbacks](./tickets/021-icon-loading.md) says Gen 1 has no shiny flag.
   - Hack profiles have no declared source for species types or move data (type, base PP for `maxPp`).

   Needed by: Core module interfaces, Gen 3 party decoder, Tracer API.
5. **What shapes do `player` and `bag` have?** (gap). [API v2 contract](./tickets/006-api-contract.md) lists the `player` fields and "bag by pocket" without shapes: badges, map location and play time, the pocket list per generation, and the bag entry shape. [Viewer design](./tickets/008-viewer-design.md) shows an eight-badge row, but Gen 2 has 16 badges. Needed by: the rest of Gen 3 and Gen 1-2.
6. **What else does the profile schema hold?** (gap). Not decided:
   - the profile field behind `status.game.name`
   - which fields `extends` inherits besides `kind`, such as `identify`, `artVersion`, `fixture` and provenance (Blue inheriting Red's `identify` would match Red's header)
   - the profile keys for the optional trainer ROM tables
   - how a hack profile with an unverified storage layout sets `features.boxes` false: a profile field, or derived from its fixtures

   Needed by: Emerald profile and generator.
7. **Where does reference data come from?** (gap). No ticket says where species, move, item and ability names, charmaps, species data, growth curves and move data come from, or which languages ship in v2.0. [License](./tickets/007-license.md) forbids copying pret C or assembly source. The build map's Gen 3 party decoder ticket assumes a dev-time script that generates them from pret sources with provenance. No ticket says where official profiles' `identify.sha1` and `crc32` lists come from either. Needed by: Gen 3 party decoder, Emerald profile and generator.
8. **What fills the unset status and error details?** (gap). Not decided:
   - the 503 error code for a cold read that times out while a game is loaded ([Read loop and latency budget](./tickets/018-read-loop.md)), since none of `disconnected`, `no_game`, `unsupported`, `unidentified` and `not_found` fits
   - the body of the SSE `400`
   - `status.rom` while disconnected or with no ROM ([Game identification](./tickets/009-game-identification.md) says it is always present), and the nullability of its header fields when ROM can't be read
   - the remaining `status.adapter` fields (the `...` in [API v2 contract](./tickets/006-api-contract.md))

   Needed by: Tracer API.
9. **Which routes serve the viewer's controls and info?** (gap). These viewer features have no route:
   - the adapter list with probe results, and the switch action ([App form factor](./tickets/003-app-form-factor.md), [Bridge wire protocol](./tickets/022-bridge-wire-protocol.md))
   - listing candidate profiles, making a manual pick and forgetting one, and the write guards for those actions ([Game identification](./tickets/009-game-identification.md), [Config file](./tickets/019-config-file.md))
   - the update banner data, the version string and `THIRD-PARTY-NOTICES.txt` for About ([Release pipeline](./tickets/017-release-pipeline.md))
   - the path of the `--debug` raw-read route ([API v2 contract](./tickets/006-api-contract.md))
   - whether Settings shows the adapter endpoints, `pollHz` and `updateCheck`, which `PUT /settings` accepts but [Viewer design](./tickets/008-viewer-design.md) doesn't list

   Needed by: the full viewer.
10. **What happens to signatures for revisions the owner doesn't own?** (gap). [Expansion hack data format](./tickets/023-expansion-hack-data-format.md) requires `test:local` to confirm each official Gen 3 signature against the owner's retail ROM before it ships. It gives no rule for revisions the owner doesn't own, such as marking them unverified or holding them back. Its decision report records this as open item 7. Needed by: FireRed/LeafGreen and Ruby/Sapphire profiles, the release candidate.
11. **How is the species-info layout confirmed, and does the signature still catch CFRU builds without DPE?** (conflict).
    - [Hack species data](./tickets/024-hack-species-data.md) says "a ROM fixture" must confirm the 0x1C stride "before either decoder ships". [Decoder test fixtures](./tickets/014-decoder-fixtures.md) and [License](./tickets/007-license.md) forbid ROM bytes in fixtures and test ROM tables on synthetic buffers plus `test:local`. Not decided: how the confirmation happens, and whether it gates the Gen 3 data format's `supported` flag or only hack species-table reading.
    - [Expansion hack data format](./tickets/023-expansion-hack-data-format.md) expects the vanilla signature to catch CFRU hacks because CFRU repoints the species-data word at `0x080001BC`. [Hack species data](./tickets/024-hack-species-data.md) says that repoint comes from DPE's `repointall`, so a CFRU build without DPE may pass the signature. Neither says whether the signature still guards those builds.

    Needed by: CFRU and hack profiles.
12. **How do prereleases ship while main stays untouched?** (conflict). [Release pipeline](./tickets/017-release-pipeline.md) has v2 development merge to main and fails a release whose tagged commit isn't reachable from `origin/main`. The [V2 build map](../v2-build/map.md) keeps main untouched until the final release ticket, while `beta` and `rc` prereleases mark milestones before that. As written, `v2.0.0-beta.1` can't pass `release.yml`. Needed by: the `v2.0.0-beta.1` prerelease.
13. **Do these text mismatches read the way the spec shows them?** (conflict, low weight). Each pair below disagrees in text. Where a section has to show one value, it shows the deciding ticket's text and points here, so one grilling pass can confirm or change each. Needed by: Tracer API (`status.game.signature`), the battle resource (warning rule and Gen 1 end marker).
    - [ROM hack name tables](./tickets/020-hack-name-tables.md) says official profiles "read nothing from ROM", while [Battle tracker data model](./tickets/012-battle-tracker-data-model.md), [Decoder test fixtures](./tickets/014-decoder-fixtures.md) and [Expansion hack data format](./tickets/023-expansion-hack-data-format.md) have them read trainer tables, class names, the money table and signature words.
    - [Battle tracker data model](./tickets/012-battle-tracker-data-model.md) logs one de-duplicated warning per battle when validation fails, and [Read loop and latency budget](./tickets/018-read-loop.md) warns after 2 s of consecutive failures. Neither says how the two combine.
    - The "Amended by" note on [API v2 contract](./tickets/006-api-contract.md) gives `status.game.signature` as `"match" | "mismatch" | null`, while [Expansion hack data format](./tickets/023-expansion-hack-data-format.md) adds `"unchecked"`. §7.4 shows the 023 values.
    - [Battle tracker data model](./tickets/012-battle-tracker-data-model.md) maps Gen 1 `wIsInBattle == 0xFF` straight to `lost`, while [Decoder test fixtures](./tickets/014-decoder-fixtures.md) keeps Gen 1-2 outcomes `unknown` until the `wBattleResult` fixture lands. Neither says whether that fallback covers the end marker.
    - [PC box reading](./tickets/013-pc-boxes.md) names an mGBA GDB-stub cap and a box cadence of "about every 2 seconds". [Bridge wire protocol](./tickets/022-bridge-wire-protocol.md) (a Lua bridge with a 64 KiB cap) and [Read loop and latency budget](./tickets/018-read-loop.md) (at most once per 1000 ms) describe a different adapter and interval. Confirm that the later tickets replace 013's text.
14. **How is RetroArch probed, and what happens when a batch is too big?** (gap).
    - [App form factor](./tickets/003-app-form-factor.md) probes every adapter, and [Bridge wire protocol](./tickets/022-bridge-wire-protocol.md) defines a usable bridge. No ticket says how the RetroArch adapter probes UDP 55355 or when RetroArch counts as usable, for example with a core that maps no ROM.
    - [Bridge wire protocol](./tickets/022-bridge-wire-protocol.md) caps a request at 512 ranges and 64 KiB, never splits a RAM read, and tests each decoder's reads alone. No rule covers a cycle whose merged batch for all demanded resources exceeds the caps.

    Needed by: mGBA bridge and adapter (caps), RetroArch adapter.
15. **Which licenses does the third-party allowlist accept?** (gap). [Release pipeline](./tickets/017-release-pipeline.md) names MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0 and 0BSD "and similar", which a CI check can't implement as written. Needed by: Workspace skeleton and CI, or whichever slice adds `scripts/notices.ts`.
