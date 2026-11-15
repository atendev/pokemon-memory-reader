# Core module interfaces

The answer to [Core module interfaces](../tickets/004-core-module-interfaces.md). Build tickets cite it as "interfaces 004". The signatures are in [004-core-module-interfaces.sketch.ts](./004-core-module-interfaces.sketch.ts), which typechecks on its own under the repo's strict tsconfig. Each section of that file names the path it becomes. A build ticket copies its section and fills in the bodies. A ticket that needs a different signature reopens this sketch, as the map's Notes ask, and does not change it inside a build slice.

The owner settled the shape in three grilling rounds and a final check on 2026-11-13 and 2026-11-14. The [decision report](./004-core-module-interfaces-report.md) lists each decision.

## Problem

Every build slice codes against the same few seams. These are the adapter, the profile, the decoder, the reference data and the resource registry. Three facts make the shape non-obvious.

- One adapter connection allows one unanswered request (spec §4.5). The main batch, cold reads, box reads, identification, the header re-read and ROM-table loads all need it, so one module has to order them.
- Decoders must stay pure and testable on synthetic buffers (spec §6.1, §12). The read loop still has to batch their reads and follow pointers between cycles (spec §8.4, §8.5).
- The API package is the single definition of every resource (spec §10). The server has to fail typecheck when a topic exists on one side only.

Constraints from earlier answers: amendment §17.1 puts the address map in `internal/`, so the `Domain` type lives there too, because `internal/` can't import `server/`. Amendment 018 splits the file schema from the full schema. Amendment 016 fixes the `Pokemon` shape and adds `moveData` and `nameTables.locations`. Amendment 026 bounds batches at profile load. Ticket 019 keys reference data by data format and language.

## Usage (caller's view)

The composition root in `server/src/main.ts` wires the modules in this order.

```ts
const { registry, problems } = loadProfiles({ builtin, user: await readUserProfiles(dataFolder), formats: dataFormats });
const adapters = [
  createBridgeAdapter("mgba", config.adapters.mgba, deps),
  createRetroArchAdapter(config.adapters.retroarch, deps),
  createBridgeAdapter("bizhawk", config.adapters.bizhawk, deps),
];
const selector = createAdapterSelector({ adapters, pinned: config.adapter === "auto" ? null : config.adapter, ...deps });
const resources = createReadLoop({ selector, registry, formats: dataFormats, picks, pollHz: config.pollHz, ...deps });
Bun.serve({ hostname: config.host, port: config.port, fetch: createApp({ resources, bridges, debug }).fetch });
```

A route handler only talks to `resources`.

```ts
app.get("/api/v2/party", async (c) => {
  const snap = await resources.get("party");
  return snap.ok ? c.json(snap.value) : c.json({ error: { code: snap.code, message: messageFor(snap.code) }, status: snap.status }, 503);
});
```

A decoder part declares named regions and gets exactly those bytes back.

```ts
export const party: ResourceDecoder<Profile<"gen3">, PartyRegions, Party> = {
  regions: (p) => ({ count: region(p.addresses.gPlayerPartyCount, 1), mons: region(p.addresses.gPlayerParty, 6 * PARTY_MON_SIZE) }),
  decode: ({ count, mons }, ctx) => {
    const n = count.u8(0);
    if (n > 6) return fail("party count above 6");
    return decodeMons(n, mons, ctx); // Result<Party>: fail("checksum") on a bad mon, else ok(party)
  },
};
```

A fixture test runs the real pipeline through a SliceAdapter.

```ts
const out = await runFixture("server/test/fixtures/emerald-us-1.0/full-party-status.fixture.json", ["party"]);
expect(out.party).toEqual(golden.party);
```

## Shape

### Module map

```
internal/src/memory.ts       Domain, Platform, MemoryAddress, PointerAddress, the address map (amendment §17.1)
server/src/
  main.ts                    composition root: flags, config, data folder, wiring
  clock.ts, log.ts           injected Clock and Log
  adapter/
    types.ts                 Adapter, ManagedAdapter, Range, ReadOutcome, AdapterState, GameInfo
    selector.ts              probing and the live adapter (spec §3.3, §4.7)
    memory.ts                createSliceAdapter, createDumpAdapter
    bridge/                  constants.ts, wire.ts, messages.ts (strict Zod), adapter.ts
    retroarch/               adapter.ts (amendment 026)
  profile/
    schema.ts                file schema (JSON Schema export) and full schema (union on dataFormat)
    registry.ts              loadProfiles, ProfileRegistry
    builtin/                 generated and hand-written profile JSON, plus a generated index.ts
  identify/                  the identification job (header, RHHEXP scan, signatures) and the pure identify()
  format/
    bytes.ts                 Bytes
    regions.ts               Region, region(), Slices, measureBatch
    types.ts                 ResourceDecoder, Decoder, DecodeContext, the lookup interfaces
    registry.ts              dataFormats with the committed `supported` flags
    gen1/ gen2/ gen3/ cfru/  each with profile.ts (its Zod blocks), layouts, decoder parts
  reference/                 referenceData(format, language), locationNames(artVersion, language)
  rom-tables/                gameLookups: hack name tables, species data, move data (a ReadJob)
  resource/
    registry.ts              resources, typed on the API package's Topic and ResourceMap
    status.ts                buildStatus
    battle-tracker.ts        battleId, revealed and lastBattle for every format
  loop/                      job.ts (ReadJob), the read loop, cycle planning, change detection
  app/                       app.ts, routes, SSE queues
server/test/
  support/                   run-fixture.ts, fake-bridge.ts
  bridge/                    cross-language tests that run the Lua core from bridges/ by path
  fixtures/<profile-id>/     spec §12.1
scripts/                     generator, find-rom-tables, fixture capture, smoke, notices
```

Dev scripts in `scripts/` import `server/` and `internal/` modules by path. `server/` gains `@pokemon-memory-reader/internal` as a `workspace:*` dependency, and the root `paths` gains `"@pokemon-memory-reader/internal/*": ["./internal/src/*.ts"]`, matching the `api/` entry.

### Load-bearing decisions

- **The read loop owns the request slot.** Everything that reads memory is a `ReadJob`, a step machine with no I/O of its own. Identification, ROM-table loading and each cycle with its pointer phases are jobs. The loop drives one job at a time through `adapter.read()` and decides their order (spec §8.2, §8.3). An overlapping `read()` call is a bug and rejects. The Hono app sees only the loop's `Resources`.
- **One adapter object per configured emulator.** It owns its socket, hello check and backoff. The selector sets its mode: `probe`, `hold` (the protocol_mismatch exception, decision 13 in the [decision report](./004-core-module-interfaces-report.md)) or `live`. The open socket carries over, which §4.7 requires. The read loop and tests depend only on `Adapter`, which the SliceAdapter also implements.
- **State, not events.** `AdapterState` is one snapshot with `gameEpoch`. `buildStatus` reads it, and the loop re-identifies when the epoch moves. Tests assert on state.
- **Named regions in, value out.** `ResourceDecoder.regions(profile)` returns a record of named regions. `decode` gets a `Bytes` per name and the `DecodeContext`, never the adapter. The usage check proves that a name the decoder didn't declare fails typecheck.
- **Per-game lookups.** `gameLookups(profile, game)` builds `names`, `speciesData`, `moveData`, `growth` and `charmap` once per loaded game from reference data and ROM tables. Decoders never see the source. Its `status` feeds `status.game.names`, `speciesData` and `moveData`.
- **Formats own their profile blocks.** `format/<id>/profile.ts` exports that format's `addresses` and `constants` Zod blocks. `profile/schema.ts` composes the full schema. So `Profile<"gen3">` has typed `MemoryAddress` and `PointerAddress` fields.
- **Registry plus tracker.** `resources` maps every topic to its source. A topic missing on either side fails `satisfies`, and so do party on the box request and battle without its tracker. The battle decoder returns a `BattleFrame`, and the one `battleTracker` adds `battleId`, `revealed` and `lastBattle` for every format.
- **Expected failures are values.** `decode` returns `ok()` or `fail()`. A thrown error, such as a `Bytes` read out of bounds, is a layout bug, which the loop logs and treats as a decode failure.
- **A format grows part by part.** Every `Decoder` part is optional. A missing part makes its resource 503 `unsupported`.

### Values

- `dataFormat`: `"gen1" | "gen2" | "gen3" | "cfru"`. `generation`: `1 | 2 | 3`.
- `language`: ISO 639-1, `"ja" | "en" | "fr" | "de" | "it" | "es" | "ko"`. It is a closed enum that already covers every official Gen 1-3 release.
- Adapter ids: `"mgba" | "retroarch" | "bizhawk"` (spec §7.4).

### Read outcomes and caps

- `read()` returns per-range data, `timeout` or `failed`. A null slice fails only the decoders that use that range: a range-check failure (spec §4.4), or a short or error RetroArch reply (amendment 026).
- `timeout` counts toward `stalled`. So does a request over the caps, which amendment 026 treats as a bug handled like a timeout. `failed` never counts.
- `loadProfiles` measures each profile's main batch and box request with `measureBatch`, using the caps and merge gap in `BRIDGE_CAPS`. Each pointer-derived region counts as its own range at full length. A profile over the caps fails to load, and CI checks every built-in. The loop never splits a batch at run time.
- `rom` reads use the same `read()`. The bridge adapter splits `rom` ranges over the caps into sequential requests (spec §4.4), and the RetroArch adapter cuts every range at descriptor boundaries and 16 KiB (amendment 026). No `rom` key in `GameInfo.domains` means no ROM access.

### Zod modules

These need zod, so they live here and not in the `.ts` sketch.

The profile schemas (`server/src/profile/schema.ts`):

```ts
import { z } from "zod";
import { gen1Blocks } from "../format/gen1/profile";
import { gen3Blocks } from "../format/gen3/profile";
// gen2, cfru alike

// Bus-notation strings. The file schema keeps them as strings, so z.toJSONSchema(profileFile) works for editors.
const addressText = z.string();
const pointerText = z.object({ ptr: z.string(), offset: z.string(), bank: z.string().optional() });

export const profileFile = z.object({
  id: z.string(), kind: z.enum(["official", "hack"]), name: z.string(), extends: z.string().optional(),
  dataFormat: z.enum(["gen1", "gen2", "gen3", "cfru"]).optional(),
  language: z.enum(["ja", "en", "fr", "de", "it", "es", "ko"]).optional(),
  provenance: provenance.optional(), // generated and .sym-built profiles; never inherited, never null in a file
  // every other field optional here; a root file is checked as complete after resolution
}).loose();

// The full schema checks the resolved profile and translates every address through internal/memory.
// Each format block's address fields use `address(platform)`, a z.string().transform that calls
// parseAddress and adds an issue naming the field and value when it fails.
export const profileFull = z.discriminatedUnion("dataFormat", [
  base.extend({ dataFormat: z.literal("gen1"), addresses: gen1Blocks.addresses, constants: gen1Blocks.constants }),
  base.extend({ dataFormat: z.literal("gen3"), addresses: gen3Blocks.addresses, constants: gen3Blocks.constants }),
  // gen2, cfru
]).superRefine(hackRules); // nameTables, speciesData, moveData required on kind "hack"
export type Profile<F extends DataFormatId = DataFormatId> = Extract<z.output<typeof profileFull>, { dataFormat: F }>;
```

The strict bridge messages (`server/src/adapter/bridge/messages.ts`, spec §4.7):

```ts
export const helloStep1 = z.object({ bridge: z.string(), protocol: z.number().int() });
export const hello = z.object({
  bridge: z.enum(["mgba", "bizhawk"]), protocol: z.literal(PROTOCOL), build: z.string(),
  emulator: z.object({ name: z.string(), version: z.string().nullable() }),
});
export const game = z.object({
  platform: z.enum(["gb", "gba", "other"]), romName: z.string().nullable(),
  crc32: z.string().nullable(), sha1: z.string().nullable(),
  domains: z.record(z.string(), z.number().int().nonnegative()), // unknown names dropped after parse
}).nullable();
export const error = z.object({ code: z.string(), message: z.string() }); // unknown code is treated as internal
```

The API package (`api/src/schemas.ts`, spec §10). Ticket 008 adds the party and `Pokemon` schemas from amendment 016, and ticket 012 builds the package.

```ts
export const TOPICS = ["status", "player", "party", "bag", "battle", "boxes"] as const;
export type Topic = (typeof TOPICS)[number];
export const resourceSchemas = { status, player, party, bag, battle, boxes } satisfies Record<Topic, z.ZodType>;
export type ResourceMap = { [T in Topic]: z.infer<(typeof resourceSchemas)[T]> };
```

The app registers one snapshot route per topic from `resourceSchemas`, so the OpenAPI document and the route types come from the same schemas. A server test validates real responses against them.

```ts
function registerSnapshot<T extends Topic>(topic: T) {
  app.openapi(snapshotRoute(topic, resourceSchemas[topic]), snapshotHandler(resources, topic)); // typed on ResourceMap[T]
}
for (const topic of TOPICS) registerSnapshot(topic);
```

## Synthesis decision

The architect skill's arena runners and the `how` skill are not installed here, so the main thread did not run an arena. It compared whole-shape alternatives itself and put each load-bearing choice to the owner. The base is the "deep read loop" shape. The other shapes it weighed are under Alternatives considered.

## Tradeoffs accepted

- We accept a single deep read loop module in exchange for one place that knows the request-slot order. Identification and ROM-table code stay pure and testable because they are `ReadJob`s.
- We accept a `hold` mode on the adapter, which only the protocol_mismatch rule uses, in exchange for keeping every socket inside its adapter.
- We accept optional decoder parts during the build in exchange for formats that land one resource at a time. The support gate (spec §12.8) is what stops a format shipping with a gap.
- We accept a closed `language` enum with seven values when v2.0 may ship fewer. A value without shipped reference data loads no profile, and adding Korean data later needs no API change.
- We accept `Bytes` as a class over `DataView` in exchange for bounds checks and no `!` under `noUncheckedIndexedAccess`.

## Alternatives considered

- A separate session module that runs identification and calls the adapter itself, with a FIFO queue in the adapter. It lost because the ordering rules in §8.2 and §8.3 would split between two modules.
- Folders by data format, each with its decoder, address schema and reference data. It lost because generated reference data would sit beside hand-written decoders.
- A stateless `probe()` plus a separate live adapter. It lost because the open socket would pass between three modules.
- Decoders reading through a guarded memory view. It lost because a wrong name or offset would fail only at run time.
- Decoders choosing between reference data and ROM tables per category. It lost because each format would repeat the builtin-or-ROM rules and their null cases.
- Decoders keeping battle state per format. It lost because `battleId`, `revealed` and `lastBattle` are the same for every format.
- One central profile schema with string-keyed addresses. It lost because a missing address would fail only at run time.

## Open questions and risks

- Ticket 014 decides the manual-pick keys and the header re-read timer. They fit behind `ManualPicks.lookup` and the identification job. If the timer has to run inside the loop's tick, it becomes one more job the loop schedules.
- Ticket 020 decides the cold-read timeout code and the unset `status` fields. `UnavailableCode` and `buildStatus` grow with it.
- Ticket 021 decides the routes for the adapter list, the switch action and manual picks. `Resources.adapters()` and `switchAdapter()` forward to `AdapterSelector.list()` and `switchTo()` for them. `Resources.pickProfile()` and `forgetPick()` forward to `ManualPicks.set()` and `clear()`, whose keys ticket 014 sets.
- `BattleFrame` is a stand-in. The battle resource ticket fills it in.
- Is the party resource a top-level array or an object? Spec §7.11 makes published schemas loose objects, which a top-level array can't be. Ticket 008 or 009 should settle it when it adds the party schema.
- This ticket updated CONTEXT.md's reference-data and art-version lines from the owner's final check. Ticket 019's branch should keep them in step with its answer.

## Next implementation step

Ticket 006 copies `server/src/adapter/bridge/constants.ts` and `wire.ts` from the sketch and adds `internal/src/memory.ts` with the `Domain` names its constants check against.
