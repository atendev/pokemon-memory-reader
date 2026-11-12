---
type: grilling
blocked_by: []
assets: []
---

# API v2 contract

## Question

What does the v2 API look like to an overlay or tracker?

Decide polling vs push (WebSocket or SSE), how clients learn which game and generation is running, how fields that differ by generation are represented (DVs vs IVs, abilities, natures), the resource list (party, player, bag, battle, boxes), versioning, and the error shape when no game or adapter is connected.

Input from [Game profile source and format](./005-game-profile-source.md): profiles have stable IDs such as `firered-us-1.0` and `radical-red-4.1`. Decide whether the API exposes them.

## Answer

The v2 API is read-only JSON over HTTP on localhost. `GET` endpoints return snapshots, and one SSE stream pushes changes. Every resource has one shape for all generations, and `status` tells clients which game and generation they're reading.

- **Transport.** `GET /api/v2/<resource>` for snapshots. `GET /api/v2/events?topics=party,battle` is an SSE stream filtered by topic, one per page, which avoids the browser's six-connections-per-origin limit. The API is read-only, so WebSocket brings nothing.
- **Events.** Each event is named after its resource and carries the whole new resource, never a diff or a refetch notice. On connect, the stream sends the current value of every subscribed topic, so clients need no separate first fetch.
- **Status.** `GET /api/v2/status`, also a stream topic, returns `{ state: "disconnected" | "no_game" | "game", adapter: { id, ... } | null, game: { profileId, name, generation, dataFormat, language } | null }`. The profile ID (`firered-us-1.0`, `radical-red-4.1`) is exposed so trackers can tell hacks from base games. `dataFormat` separates CFRU from vanilla Gen 3.
- **Resources in v2.0.** `status`, `player` (name, trainer ID and secret ID, money, badges, map location, play time), `party`, `bag` (by pocket) and `battle`. `battle` returns `{ active: false }` outside battle, and its contents belong to the battle tracker decision. `boxes` is reserved in the route namespace and waits on the PC box decision.
- **One shape for all generations.** Each resource has a single shape. A field a generation lacks is `null`, never omitted, so keys stay stable. Gen 1–2 values go in the modern keys (`hp, atk, def, spa, spd, spe`) without rescaling:
  - `ivs` holds DVs (0–15). `spa` and `spd` both get the Special DV, and `hp` gets the derived HP DV.
  - `evs` holds Stat Experience (0–65535). `spa` and `spd` both get Special Stat Exp.
  - `stats` in Gen 1: `spa` and `spd` both get the Special stat.
  - `ability` and `nature` are `null` in Gen 1–2. `heldItem` is `null` in Gen 1.
- **Computed fields.** Every Pokemon carries `shiny` (boolean), `gender` (`"male" | "female" | "genderless"`, `null` in Gen 1) and `hiddenPower` (`{ type, power }`, `null` in Gen 1). The decoder does the generation-specific DV and personality-value math, so clients never do.
- **References.** `species` is `{ id, dex, name }`: `id` is the game's internal index, `dex` is the National Dex number or `null` for hack-only species, and `name` is the decoded name. Moves and items are `{ id, name }`.
- **Documenting differences.** Each field's Zod `.describe()` states its range and which generations fill it, and this flows into the OpenAPI document. The API docs carry one "Generation differences" table. Responses carry no range metadata, because `status.game.generation` picks the row.
- **Versioning.** Path prefix `/api/v2`, with only additive changes within it (new fields, new resources). A breaking change means `/api/v3`. OpenAPI is served at `/api/v2/openapi.json`.
- **Errors.** `status` always returns `200`. Other resources return `503 { error: { code: "disconnected" | "no_game" | "unsupported", message }, status }` when no data exists. The SSE stream never errors: it keeps emitting `status` and holds other topics until they have data. Successful responses aren't wrapped in an envelope.
- **CORS.** `Access-Control-Allow-Origin: *`, and Private Network Access preflights get `Access-Control-Allow-Private-Network: true`, so hosted HTTPS overlays can reach localhost. There's no auth, because the API is read-only.
- **Raw memory.** No raw read in the public contract. A raw read endpoint exists only under `--debug`, outside `/api/v2`, with no stability promise.
- **Conventions.** JSON keys are camelCase. Strings are UTF-8, decoded through the game's charmap.

A single shape per resource keeps overlay code free of per-generation branches. The real differences (ranges, the shared Special, derived gender and shininess) are documented, or computed on the server.

Excluded: polling-only, WebSocket, JSON Patch diffs, change notices that force a refetch, per-generation discriminated unions, separate `dvs` and `statExp` fields, rescaling DVs to 0–31, a `{ status, data }` envelope, `200 null` for missing data, header-based versioning, and a public raw memory endpoint.

Amended by [Battle tracker data model](./012-battle-tracker-data-model.md): `battle` outside battle is `{ active: false, lastBattle: LastBattle | null }`.

Amended by [PC box reading](./013-pc-boxes.md): adds `status.game.features`, the `not_found` error code, the `boxes` resource shape, and nullable `hp`, `maxHp`, `stats` and `status` on the shared Pokémon schema.
