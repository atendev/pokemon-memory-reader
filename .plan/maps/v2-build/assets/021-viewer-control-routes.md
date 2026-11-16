# Viewer control routes: amendment for spec §17 item 9

Answers [Which routes serve the viewer's controls and info?](../tickets/021-viewer-control-routes.md). Cite as "amendment 021, item N". Decided in auto mode.

## Amendment

1. **Namespace.** Viewer controls and info live in root-level internal routes beside `/settings` and `/debug`: `/adapters`, `/manual-picks`, `/about` and `/update`. Like §9.5, they sit outside `/api/v2`, carry no stability promise, stay out of OpenAPI and the API package, and keep their contracts in `internal/`.

2. **Viewer URLs.** The viewer uses hash routes (`/#/party`, `/#/settings`), and the server serves it only at `/`. No viewer URL can collide with a server route, and every root-level path stays reserved for the server.
   - URL overrides such as `showUnrevealed` keep §11.4's page-query form (`http://127.0.0.1:7425/?showUnrevealed=1#/battle`). This amends §11.4 to also accept the hash-query form (`http://127.0.0.1:7425/#/battle?showUnrevealed=1`), and the docs show both. The hash query wins on conflict. A test covers both forms.

3. **Guard classes.** Every route outside `/api/v2` belongs to one class:
   - **Open read.** Any peer. `GET /settings`, `GET /adapters`, `GET /manual-picks`, `GET /about`, `GET /about/third-party-notices.txt`, `GET /update`.
   - **Write guard.** The four §9.5 checks as one shared guard: loopback peer, `Content-Type: application/json`, the Host allowlist with port, and any `Origin` equal to the server's own. It covers `PUT /settings`, `POST /settings/icon-cache/clear`, `POST /adapters/switch`, `POST /adapters/probe`, `POST /manual-picks` and `POST /manual-picks/forget`. Every write takes a JSON body, and the empty ones send `{}`, so the Content-Type check works the same way everywhere.
   - **Debug guard.** `GET /debug/metrics` and `GET /debug/read`, registered only under `--debug` (otherwise 404). The peer must be loopback, and `Host` must be `localhost`, `127.0.0.1` or `[::1]` with the port, never the configured bind host. A DNS-rebinding page on the same machine passes the peer check, so §9.9's "loopback peers only" gains the Host check.
   - **Static.** `/bridges/<name>.lua`, `/icons/...` and the viewer at `/`.
   - No internal route sends `Access-Control-Allow-Origin` or approves a preflight. The viewer is same-origin.
   - **Tests.** Each rejection path of the shared guard has a test. A route-table test in `server/` lists every route outside `/api/v2` with its class. It fails when a registered route is missing from the table, and it sends a bad Host to every write-guard and debug-guard route and expects 403. The test starts the server with `--debug` on, so the debug routes exist.

4. **Error shape and codes.** Internal routes, `/settings` included, answer errors as `{ error: { code, message } }` without the public `status`. `code` is a closed enum in `internal/`, since only the viewer reads it, and the viewer still shows `message` for any code it doesn't know.

   | Code | HTTP | When |
   |---|---|---|
   | `write_forbidden` | 403 | a write guard or debug guard check fails |
   | `invalid_request` | 400 | a malformed body or query on a non-settings route, such as an unparseable `address` or a missing `length` |
   | `invalid_setting` | 400 | a `PUT /settings` patch fails the schema |
   | `saves_refused` | 409 | malformed `config.json` or a newer `configVersion` (§9.4). The message names the path. |
   | `save_failed` | 500 | the settings write fails on I/O |
   | `adapter_not_usable` | 409 | switch target's last probe isn't `usable` |
   | `adapter_pinned` | 409 | switch or probe while `adapter` is pinned |
   | `adapter_connect_failed` | 409 | the switch connection failed its checks |
   | `switch_in_progress` | 409 | a switch while a switch or probe runs, or a probe while a switch runs |
   | `no_rom` | 409 | a pick or forget while no ROM is loaded |
   | `pick_not_allowed` | 409 | a pick while a ROM is loaded but `state` is neither `unidentified` nor a game with `match: "manual"`, as after an automatic match or while ROM tables load |
   | `forget_not_allowed` | 409 | a forget while the current match isn't `manual` |
   | `base_pick_not_allowed` | 409 | scope `base` for a profile that isn't `baseEligible` |
   | `unknown_profile` | 409 | the profile isn't in the candidate list |
   | `expansion_rom` | 409 | a pick on a ROM with an expansion block (§5.7) |
   | `not_connected` | 409 | a raw read with no live adapter or memory map |
   | `bad_read` | 400 | a raw read whose parsed address is unmapped or whose `length` is outside 1-4096 |
   | `read_busy` | 409 | a raw read while another raw read is queued or running |

5. **Adapter list.** `GET /adapters` returns the last known state and never probes.

   ```ts
   { mode: "auto" | "pinned", live: AdapterId | null,
     adapters: { id, endpoint: { host, port }, live: boolean,
       probe: { result, bridge: Hello | null, problem: ProblemCode | null,
         checkedAt: string | null } }[] }   // priority order
   ```

   - `result` is `"live" | "usable" | "busy" | "refused" | "no_reply" | "problem" | "not_probed"`. `not_probed` covers the time before the first probe finishes and, while pinned, every adapter except the pinned one. `problem` always has a `problem` code (`unknown_bridge`, `protocol_mismatch`, `bridge_error`), and `problem` is null for every other result. `bridge` holds the hello that answered, so the viewer can name a wrong bridge (§4.7). It is set for `live`, `usable`, `busy` and `problem` when a hello arrived, and null otherwise (`refused`, `no_reply`, `not_probed`, RetroArch, and a problem bridge that sent no hello).
   - While an adapter is live, non-live adapters are re-probed on ticket 007's backoff. A probe never touches the live endpoint (§4.7), and a RetroArch probe (up to 1 s) never blocks the read loop.
   - While pinned, the pinned adapter shows its real result and the others show `not_probed`, since a pin turns probing off (§3.3).
   - The viewer polls it every 2 s, but only while the connection screen, the not-connected or no-game empty state, or Settings is open.

6. **Probe now.** `POST /adapters/probe {}` re-probes every non-live adapter at once and returns the new `GET /adapters` body. It doesn't reset the backoff, because only a live connection does (007). Overlapping probe calls share one run. While a switch runs it answers `switch_in_progress`, and while pinned it answers `adapter_pinned`. The viewer shows it as a "Check again" button.

7. **Switch.** `POST /adapters/switch { id }` changes the live adapter for this run only. It never writes `config.json` and leaves `adapter: "auto"` and probing on. A persistent choice is a pin, set through `PUT /settings`.
   - While not pinned, a switch to the adapter that is already live does nothing and returns `200 { live: id }`. While pinned, every switch gets `adapter_pinned`, the pinned adapter included.
   - Refused with `adapter_pinned` while pinned (the viewer says "Unpin in Settings to switch"), `adapter_not_usable` unless the target's last probe is `usable`, and `switch_in_progress` while another switch or probe runs.
   - The program opens a real connection to the target and runs the hello and game-message checks while the old adapter stays live. On success the read loop swaps adapters and the POST returns `200 { live: id }`. On failure it returns `adapter_connect_failed` and the old adapter stays live. The POST waits at most the 3 s hello timer, or 1 s for RetroArch's `GET_STATUS`.
   - If the switched-to adapter later disconnects, auto probing resumes in priority order.

8. **Manual picks.** The routes act on the ROM loaded now. The server derives the key from that ROM's signals (amendment 014 item 2), and the client never sends a key.
   - `GET /manual-picks` returns:

     ```ts
     { romKey: string | null,
       current: { key, scope: "rom" | "base", profileId } | null,   // the entry that applied
       candidates: { id, name, kind, dataFormat, headerMatch: boolean,
         signature: "match" | "mismatch" | "unchecked" | null, baseEligible: boolean }[] }
     ```

     Candidates are every loaded profile whose platform matches `status.rom.platform` (GB covers gb and gbc), header matches first, then by name. `signature` is null for a profile that declares none. `baseEligible` means the profile meets amendment 014 item 3, computed by the same function the load path uses. The list is empty with no ROM or an expansion ROM.
   - `POST /manual-picks { profileId, scope }` is allowed while `state` is `unidentified` or the game loaded with `match: "manual"`, so a pick can be changed. An automatic match can't be overridden, since picks come last in the §5.4 order. The refusal codes, checked in this order, are `no_rom`, `expansion_rom`, `pick_not_allowed`, `unknown_profile` and `base_pick_not_allowed`.
   - The pick applies for the session either way. The response is `{ key: string | null, scope, profileId, saved: boolean, reason: "no_key" | "write_failed" | null }`. `key` is null exactly when `reason` is `no_key`. So a pick with no ROM key, or one whose file write failed, still loads and the viewer says it won't be remembered.
   - `POST /manual-picks/forget {}` is allowed only while the current match is `manual` (`no_rom`, `forget_not_allowed` otherwise). It removes the entry that applied (both hash keys when there are two, or the `base:` entry) and re-identifies. The read loop treats both steps as one change, so no reader sees a half state, and the ROM normally lands back on `unidentified`.
   - The viewer fetches `GET /manual-picks` while the unidentified empty state or a manual-pick warning is shown. It fetches again when an SSE `status` event changes `state`, `rom` or `game.match`, and after its own pick or forget returns.
   - v2.0 has no route to list or forget picks for other ROMs. A user edits `manual-picks.json` by hand.

9. **About.** `GET /about` returns `{ version, target, commit, versionLine }`, where `versionLine` is the `--version` text (§9.3) and `commit` is `dev` in a local build. `GET /about/third-party-notices.txt` serves `THIRD-PARTY-NOTICES.txt` from `scripts/notices.ts`. This adds a build requirement: the release build runs `scripts/notices.ts` before `bun build --compile` and embeds the file in the executable, and the route serves it as `text/plain; charset=utf-8` with `X-Content-Type-Options: nosniff`. A dev build without the generated file answers 404, and About says notices ship with release builds.

10. **Update banner.** `GET /update` returns `{ enabled, current, latest: { version, url } | null, checkedAt: string | null }` from the last §9.8 check and never calls GitHub. `latest` is set only when a newer release exists, and `url` is the release page. With `updateCheck` off, it returns `enabled: false` and `latest: null`. The viewer fetches it on load, every 30 min, and after a `PUT /settings` that changes `updateCheck`. Dismissing the banner for one version lives in localStorage.

11. **Raw read.** `GET /debug/read?address=<addr>&length=<n>`, debug guard only.
    - `address` uses amendment 013's bus notation and parser: GBA hex such as `0x02024284`, or GB `bank:address` such as `01:D163`. The 013 memory map converts it to domain and offset. `length` is 1-4096, inside both bridge caps and RetroArch's 16 KiB.
    - The read uses the read loop's one request slot (interfaces 004). The loop runs a waiting raw read after the current tick's batch finishes and before the next tick starts, so it delays polling by at most one read, bounded in time by the adapter's read timeout. Only one raw read can be queued or running at a time, and any other gets `read_busy`.
    - It returns `{ address, domain, offset, length, hex }`. Errors are `invalid_request` when `address` doesn't parse or `length` is missing or not an integer, `bad_read` for an unmapped address or a length outside 1-4096, `read_busy`, and `not_connected` with no live adapter or memory map.

12. **Settings fields.** Settings shows the adapter endpoints, `updateCheck` and `pollHz`, which resolves §11.7's open question.
    - The adapter section has each adapter's host and port next to the pin. For mGBA and BizHawk it notes that the bridge must be reloaded in the emulator after a change (§4.1). RetroArch has no bridge file, so it gets no note.
    - `updateCheck` is a toggle that applies live (§9.8).
    - `pollHz` sits in an Advanced section and shows its 5-60 range.

13. **Paths.** `GET /settings` gains `paths: { dataFolder, configFile, profiles, bridges, iconPack, iconCache }`, the paths §11.2 and §11.7 show. Paths can expose the OS user name, so `paths` is null for non-loopback peers, and the icon pack and icon cache paths move into it. This amends §9.5 for LAN readers. The icon cache size stays outside `paths` and is visible to all. A LAN viewer shows "open the viewer on this machine to see the path". A test covers both peer cases.

## Sketch

```ts
// internal/: one Zod module per family, each with its schemas and error codes
type GuardClass = "open" | "write" | "debug" | "static";
type InternalErrorCode =
  | "write_forbidden" | "invalid_request" | "invalid_setting" | "saves_refused" | "save_failed"
  | "adapter_not_usable" | "adapter_pinned" | "adapter_connect_failed" | "switch_in_progress"
  | "no_rom" | "pick_not_allowed" | "forget_not_allowed" | "base_pick_not_allowed"
  | "unknown_profile" | "expansion_rom" | "not_connected" | "bad_read" | "read_busy";
type ProbeResult = "live" | "usable" | "busy" | "refused" | "no_reply" | "problem" | "not_probed";

// server/: the table the route-table test checks
const ROUTES: { method: "GET" | "PUT" | "POST"; path: string; guard: GuardClass }[] = [
  { method: "GET",  path: "/settings",              guard: "open" },
  { method: "PUT",  path: "/settings",              guard: "write" },
  { method: "POST", path: "/settings/icon-cache/clear", guard: "write" },
  { method: "GET",  path: "/adapters",              guard: "open" },
  { method: "POST", path: "/adapters/probe",        guard: "write" },
  { method: "POST", path: "/adapters/switch",       guard: "write" },
  { method: "GET",  path: "/manual-picks",          guard: "open" },
  { method: "POST", path: "/manual-picks",          guard: "write" },
  { method: "POST", path: "/manual-picks/forget",   guard: "write" },
  { method: "GET",  path: "/about",                 guard: "open" },
  { method: "GET",  path: "/about/third-party-notices.txt", guard: "open" },
  { method: "GET",  path: "/update",                guard: "open" },
  { method: "GET",  path: "/debug/metrics",         guard: "debug" },
  { method: "GET",  path: "/debug/read",            guard: "debug" },
  // static: /, /bridges/:file, /icons/*
];
```

## Why

- §9.5 and §9.9 already put viewer-only routes at the root with their contracts in `internal/`. Following that keeps the public `/api/v2` contract to game data, and the additive-only promise never binds a viewer control.
- One shared write guard plus a route table makes an unguarded new write route fail a test instead of relying on someone remembering to write one.
- A switch that doesn't touch config, and that keeps the old adapter until the new one passes its checks, makes a failed switch cost nothing. A pin stays the explicit, persistent choice.
- The server derives pick keys, so a client can't write an arbitrary key, and "forget removes the entry that applied" (014 item 4) has one meaning.
- `GET` routes never probe, fetch from GitHub or write. Polling only on the screens that show the data keeps the cost at zero elsewhere and avoids a second SSE stream per page.

## Excluded

- Viewer controls inside `/api/v2`, a public `adapters` SSE topic, or an internal SSE stream.
- Moving `/settings` under a new `/app/` prefix.
- A `GET` that probes, and a fixed 10 s re-probe.
- A switch that writes a pin, or that closes the old adapter first.
- Picks by key (`PUT/DELETE /manual-picks/:key`), overriding an automatic match, and refusing a pick when its save fails.
- Listing or forgetting picks for other ROMs (deferred to v2.x).
- A raw read by `domain`/`offset`, or one that returns an octet-stream body.
- Open enums for internal error codes, and CORS on internal routes.

## Spec sections to update later

- §3.3: the adapter list, probe-now and switch routes (items 5-7).
- §7.1: the raw-read path (item 11).
- §9.5: the shared guard, guard classes, error shape and codes, `paths` and its LAN rule (items 3, 4 and 13).
- §9.6: the pick routes (item 8).
- §9.8: `GET /update` (item 10).
- §9.9: the debug guard's Host check and `/debug/read` (items 3 and 11).
- §11.1, §11.2, §11.4 and §11.7: hash routes, the OBS URL form, the routes each screen reads and the Settings fields (items 2, 5, 9, 10, 12 and 13).
- §13.5: the notices route, and the build step that generates and embeds the file (item 9).
- §17 item 9: resolved by this amendment.
