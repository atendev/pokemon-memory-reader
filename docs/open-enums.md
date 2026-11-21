# Open enums in `/api/v2`

An open enum is a field whose value a client reads as a string and must tolerate when it doesn't know the name. Open does not mean a known name may go away. Inside `/api/v2` every open enum is append-only (amendment 035): a shipped name is never removed, renamed or given another meaning. A name may stop being emitted only when the thing it stands for no longer exists, and it then stays listed with a `retiredIn` version.

## The open enums

- `errorCode`: `error.code` in every 503, 404 and 400 body.
- `dataFormat`: `status.game.dataFormat`.
- `adapterId`: `status.adapter.id`.
- `bridgeId`: `status.adapter.bridge.bridge`.
- `adapterProblem`: `status.adapter.problem`.
- `topic`: the topic names, which are the resource routes.
- `battleMode`: each element of `battle.modes` and `lastBattle.modes`. A name ships with its verification fixture and a generation-neutral, yes/no meaning (amendment 015). Tags are independent and can co-occur, and the array is unique and sorted in code-point order.

## Records

Each list is rendered from `api/src/meanings.ts` by `bun api/scripts/open-enums.ts docs`. A test fails when the lists go stale. Edit the records, never the lists.

<!-- open-enums:start -->

### `errorCode`

- `disconnected`: No usable adapter.
- `no_game`: Connected, no ROM or ROM tables still loading.
- `unidentified`: A ROM is loaded but no profile matched.
- `unsupported`: The profile's data format isn't supported, the profile marks the resource unsupported, or the adapter can't perform the resource's main read.
- `not_found`: GET /boxes/:n with an out-of-range or non-integer :n (404).
- `no_data`: A game is loaded and the resource is supported, but the resource has no value yet.
- `invalid_topics`: The event stream's topics query is missing or names no known topic (400).

### `dataFormat`

- `gen1`: Generation 1 save and party layout.
- `gen2`: Generation 2 save and party layout.
- `gen3`: Generation 3 vanilla layout.
- `cfru`: Complete Fire Red Upgrade layout, which extends Generation 3.

### `adapterId`

- `mgba`: The mGBA scripting bridge.
- `retroarch`: RetroArch network commands.
- `bizhawk`: The BizHawk Lua bridge.

### `bridgeId`

- `mgba`: The bridge script running inside mGBA.
- `bizhawk`: The bridge script running inside BizHawk.

### `adapterProblem`

- `unknown_bridge`: The endpoint sent no valid hello, or the hello names a bridge other than the one the endpoint should answer with.
- `protocol_mismatch`: The bridge speaks a different protocol version.
- `busy`: Another program instance already holds the bridge connection.
- `bridge_error`: After a valid hello, the bridge sent an error or a game message that failed validation.

### `topic`

- `status`: The adapter, ROM and game state. Always served.
- `party`: The player's party, in slot order.
- `player`: The player's name, IDs, money, badges, map location and play time.
- `bag`: The player's bag pockets and the items in each, in game order.
- `battle`: The current battle, or whether none is active and the last one that ended.
- `boxes`: The PC boxes and the current box, in game order. Read on demand, at most once a second.

### `battleMode`

No name is emitted yet.

<!-- open-enums:end -->

## Keeping the records append-only

- Adding a name is a minor release. Add its line to the record, run the `docs` command and commit both.
- Retiring a name sets its `retiredIn` to the app version and leaves the meaning text alone.
- `api/open-enums.baseline.json` holds every name, meaning text and `retiredIn` as of the last stable `api-v` release. `api/src/open-enums.test.ts` fails when the records drop a baseline name, change its meaning text or change a set `retiredIn`. The file doesn't exist before `api-v2.0.0`, and the test skips with a message.
- The `RELEASING.md` step for a stable `api-v` tag: run `bun api/scripts/open-enums.ts baseline` and commit the file in the release commit. The only other edit to the file is a wording-only meaning fix made together with its record, in its own amendment's commit. Review every change to the file, because a baseline rewritten to match a bad edit passes the test.
