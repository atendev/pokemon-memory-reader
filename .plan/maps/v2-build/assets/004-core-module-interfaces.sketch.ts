// Core module interfaces for v2: the code sketch from ticket 004.
//
// Signatures only. Each `// === <path>` banner names the file a section becomes. A build
// ticket copies its section into that file and fills in the bodies. It does not change a
// signature without reopening this sketch. The rationale is in
// 004-core-module-interfaces.md beside this file.
//
// This file typechecks on its own under the repo's root tsconfig (strict,
// noUncheckedIndexedAccess). The Zod modules (profile schemas, bridge messages, api schemas)
// are shown as code blocks in the rationale, because zod is not installed yet. The API
// package types below are stand-ins for `@pokemon-memory-reader/api/schemas`.

// === api/src/schemas.ts (stand-ins; the real file infers these from Zod, spec §10)

export const TOPICS = ["status", "player", "party", "bag", "battle", "boxes"] as const;
export type Topic = (typeof TOPICS)[number];
interface StandIn<K extends string> {
  readonly standIn: K;
}
export interface ResourceMap {
  status: StandIn<"status">;
  player: StandIn<"player">;
  party: StandIn<"party">;
  bag: StandIn<"bag">;
  battle: StandIn<"battle">;
  boxes: StandIn<"boxes">;
}
export type Status = ResourceMap["status"];
export type Box = StandIn<"box">;
/** Stand-in for a Zod schema whose output is Out. */
export interface SchemaStandIn<Out> {
  readonly output: Out;
}
/** Zod schema per topic, whose output is ResourceMap[T]. The OpenAPI routes and the response tests use it (spec §10). */
export declare const resourceSchemas: { readonly [T in Topic]: SchemaStandIn<ResourceMap[T]> };
/** The 503 codes this server produces (spec §7.2), a closed set. Ticket 020 adds the cold-read timeout code. */
export type UnavailableCode = "disconnected" | "no_game" | "unidentified" | "unsupported";
/** The API package's error code: the known values plus any string, an open enum (spec §7.11). */
export type ApiErrorCode = UnavailableCode | "not_found" | (string & {});

// === internal/src/memory.ts (memory domains and the address map, amendment §17.1)

export type Platform = "gb" | "gba";
export type GbaDomain = "rom" | "ewram" | "iwram";
export type GbDomain = "rom" | "wram" | "hram" | "sram";
/** A memory domain (spec §3.2). Every adapter, decoder, profile and fixture uses these names. */
export type Domain = GbaDomain | GbDomain;

/** A static location in one memory domain. Every static profile address becomes one at load. */
export interface MemoryAddress {
  readonly domain: Domain;
  readonly offset: number;
}

/** A profile pointer entry after load (amendment §17.1 item 6). */
export interface PointerAddress {
  /** Where the pointer word sits. */
  readonly at: MemoryAddress;
  /** 4 on GBA, 2 on GB, little-endian. */
  readonly width: 2 | 4;
  /** GB only: the bank of the pointer's target. Always null on GBA. */
  readonly bank: number | null;
  /** Added to the mapped target's domain offset. */
  readonly offset: number;
}

/** What a profile address becomes after load: static, or read through a pointer. */
export type ProfileAddress = MemoryAddress | PointerAddress;

export type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

/** Bus notation to domain and offset. Errors name the value. Only canonical ranges map. */
export declare function parseAddress(
  platform: Platform,
  text: string,
): Parsed<MemoryAddress>;

/** Maps a pointer value read from memory. 0 and unmapped values give null (amendment §17.1 item 7). */
export declare function mapPointerValue(
  platform: Platform,
  value: number,
  bank: number | null,
): MemoryAddress | null;

// === server/src/clock.ts and server/src/log.ts

/** Injected into the read loop and adapters so tests drive time without sleeping. */
export interface Clock {
  now(): number;
  /** Returns a cancel function. */
  setTimeout(callback: () => void, ms: number): () => void;
}

export interface Log {
  debug(message: string, data?: object): void;
  info(message: string, data?: object): void;
  warn(message: string, data?: object): void;
  error(message: string, data?: object): void;
}

// === server/src/adapter/types.ts (spec §3, §4)

export type AdapterId = "mgba" | "retroarch" | "bizhawk";

/** One contiguous run of bytes in one memory domain. The adapter reads ranges. */
export interface Range {
  readonly domain: Domain;
  readonly offset: number;
  readonly length: number;
}

export interface AdapterLimits {
  /** Floor on the tick interval (spec §3.1, §8.1). Default 0. */
  readonly minIntervalMs: number;
  /** Ranges in one domain closer than this merge into one (spec §3.1, §8.4). Default 32. */
  readonly mergeGap: number;
}

/** Outcome of one batched read. */
export type ReadOutcome =
  | {
      readonly kind: "data";
      /**
       * One entry per requested range, in request order. null means that range failed on
       * its own: the adapter's range check against the game's domain sizes (spec §4.4), or a
       * short or error RetroArch reply (amendment 026). Only decoders using it fail.
       */
      readonly slices: ReadonlyArray<Uint8Array | null>;
    }
  /**
   * No reply within the timeout, or an earlier timed-out request is still unanswered
   * (spec §4.5). Also a request over the caps, which is a bug (amendment 026). Counts toward
   * `stalled` (spec §8.6).
   */
  | { readonly kind: "timeout" }
  /** No data this cycle. Never counts toward `stalled`. */
  | { readonly kind: "failed"; readonly reason: ReadFailure };

export type ReadFailure =
  /** An ERROR reply such as bad_range, too_large or internal (spec §4.6). */
  | "bridge_error"
  /** The reply was unusable: wrong length, or sent before a game message (spec §4.3, §4.5). */
  | "dropped"
  /** No ROM is loaded. The adapter's state changes too. */
  | "no_game"
  /** Not connected, or the connection closed mid-request. */
  | "disconnected";

export type AdapterProblem =
  | "unknown_bridge"
  | "protocol_mismatch"
  | "busy"
  | "bridge_error";

/** A hello after the strict wire check, or only bridge and protocol on a mismatch (spec §4.7). */
export interface BridgeHello {
  readonly bridge: string;
  readonly protocol: number;
  readonly build: string | null;
  readonly emulator: {
    readonly name: string;
    readonly version: string | null;
  } | null;
}

/** What the adapter knows about the loaded ROM: the bridge game message (spec §4.3) or RetroArch's GET_STATUS (amendment 026). */
export interface GameInfo {
  readonly platform: Platform | "other";
  readonly crc32: string | null;
  readonly sha1: string | null;
  /** Logs only. */
  readonly romName: string | null;
  /** Reachable size per domain. No `rom` key means the adapter can't read ROM. */
  readonly domains: Readonly<Partial<Record<Domain, number>>>;
}

/** One read-only snapshot. Listeners get the next one on every change. */
export interface AdapterState {
  readonly connection: "disconnected" | "connecting" | "connected";
  /** `status.adapter.bridge`. null for RetroArch or before a hello. */
  readonly bridge: BridgeHello | null;
  readonly problem: AdapterProblem | null;
  /** null: no ROM (a null game message, a no_game error, RetroArch CONTENTLESS). */
  readonly game: GameInfo | null;
  /** Goes up by one on every game message or content change. The read loop re-identifies when it changes. */
  readonly gameEpoch: number;
}

/** What the read loop and fixture tests use. SliceAdapter implements only this. */
export interface Adapter {
  readonly id: string;
  readonly limits: AdapterLimits;
  readonly state: AdapterState;
  /** Listeners run synchronously on each state change, before the adapter takes its next step. */
  subscribe(listener: (state: AdapterState) => void): () => void;
  /**
   * One batched read (spec §8.4). `rom` ranges use the same call. Callers never overlap
   * calls: the read loop owns the one request slot (spec §4.5), so a second call while one
   * is pending is a bug and rejects. The bridge adapter splits `rom` ranges over the caps
   * into sequential requests and never splits RAM (spec §4.4). The RetroArch adapter cuts
   * every range at descriptor boundaries and 16 KiB (amendment 026).
   */
  read(ranges: readonly Range[], timeoutMs: number): Promise<ReadOutcome>;
}

/**
 * - probe: connect, check the hello and report it in state, then close and retry with backoff
 *   (spec §4.7). The selector decides inside its subscribe listener. If it sets live or hold
 *   before the listener returns, the connection stays open and carries over.
 * - hold: keep the open connection idle and send nothing (the protocol_mismatch exception).
 * - live: stay connected and serve reads, reconnecting with backoff.
 */
export type AdapterMode = "probe" | "hold" | "live";

/** What the selector uses. One long-lived instance per configured emulator. */
export interface ManagedAdapter extends Adapter {
  readonly id: AdapterId;
  /** mgba 0, retroarch 1, bizhawk 2 (spec §3.3). */
  readonly priority: number;
  setMode(mode: AdapterMode): void;
  close(): Promise<void>;
}

export interface Endpoint {
  readonly host: string;
  readonly port: number;
}

export interface AdapterDeps {
  readonly clock: Clock;
  readonly log: Log;
}

// === server/src/adapter/bridge/adapter.ts and server/src/adapter/retroarch/adapter.ts

export declare function createBridgeAdapter(
  bridge: "mgba" | "bizhawk",
  endpoint: Endpoint,
  deps: AdapterDeps,
): ManagedAdapter;

export declare function createRetroArchAdapter(
  endpoint: Endpoint,
  deps: AdapterDeps,
): ManagedAdapter;

// === server/src/adapter/selector.ts (probing and the live adapter, spec §3.3, §4.7)

export interface AdapterSummary {
  readonly id: AdapterId;
  readonly state: AdapterState;
  readonly live: boolean;
}

export interface AdapterSelector {
  readonly live: Adapter | null;
  /** Every configured adapter in priority order. `status.adapter` and the viewer's list read it. */
  list(): readonly AdapterSummary[];
  subscribe(listener: () => void): () => void;
  /** The viewer's switch action. Its route belongs to ticket 021. */
  switchTo(id: AdapterId): void;
  close(): Promise<void>;
}

export declare function createAdapterSelector(options: {
  readonly adapters: readonly ManagedAdapter[];
  /** The `adapter` setting. null means "auto". A pin turns probing off. */
  readonly pinned: AdapterId | null;
  readonly clock: Clock;
  readonly log: Log;
}): AdapterSelector;

// === server/src/adapter/bridge/constants.ts and wire.ts (spec §4.2, §4.4, §4.6)

export const PROTOCOL = 1;
export const FRAME_KIND = {
  HELLO: 1,
  GAME: 2,
  READ: 3,
  DATA: 4,
  ERROR: 5,
} as const;
export const MAX_BODY = {
  HELLO: 4096,
  GAME: 4096,
  READ: 4610,
  DATA: 65536,
  ERROR: 4096,
} as const;
/** The bridge caps and merge gap. loadProfiles measures every profile's main batch and box request with them (amendment 026). */
export const BRIDGE_CAPS = { maxRanges: 512, maxBytes: 65536, mergeGap: 32 } as const;
export const DOMAIN_CODES = {
  rom: 1,
  ewram: 2,
  iwram: 3,
  wram: 4,
  hram: 5,
  sram: 6,
} as const satisfies Record<Domain, number>;
export const ERROR_CODES = [
  "bad_frame",
  "busy",
  "no_game",
  "bad_range",
  "too_large",
  "unknown_kind",
  "internal",
] as const;
export const DEFAULT_BRIDGE_PORTS = { mgba: 7426, bizhawk: 7427 } as const;

export interface Frame {
  readonly kind: number;
  readonly id: number;
  readonly body: Uint8Array;
}

export declare function encodeFrame(
  kind: number,
  id: number,
  body: Uint8Array,
): Uint8Array;
export declare function encodeReadBody(ranges: readonly Range[]): Uint8Array;

/** Hand-written incremental frame decoder. A bad frame stops it (spec §4.2). */
export declare class FrameDecoder {
  push(
    chunk: Uint8Array,
  ):
    | { readonly frames: readonly Frame[] }
    | { readonly badFrame: string };
}

// === server/src/adapter/memory.ts (SliceAdapter and DumpAdapter, spec §12.3, §12.4)

export interface RecordedRegion {
  readonly domain: Domain;
  readonly offset: number;
  readonly bytes: Uint8Array;
}

/** Serves only recorded regions. Rejects any range outside them, so a fixture missing a declared region fails loudly. */
export declare function createSliceAdapter(
  regions: readonly RecordedRegion[],
  platform: Platform,
): Adapter;

/** Serves whole per-domain dumps for `fixture:capture --from-dump`. */
export declare function createDumpAdapter(
  dumps: Readonly<Partial<Record<Domain, Uint8Array>>>,
  platform: Platform,
): Adapter;

// === server/src/format/bytes.ts (byte-reading helpers)

/**
 * A read-only view over one slice. Getters take offsets from the slice's start and throw a
 * RangeError when out of bounds. That is a layout bug, which the read loop logs as a decode
 * failure. Struct layouts stay in each format as `as const` offset tables.
 */
export declare class Bytes {
  constructor(bytes: Uint8Array);
  readonly length: number;
  u8(offset: number): number;
  u16le(offset: number): number;
  u32le(offset: number): number;
  /** Gen 1-2 multi-byte values. */
  u16be(offset: number): number;
  /** Gen 1-2 experience. */
  u24be(offset: number): number;
  /** Packed BCD, such as Gen 1-2 money. */
  bcd(offset: number, length: number): number;
  /** Takes `count` bits at `shift` from a value already read with an explicit-endian getter. */
  static bits(value: number, shift: number, count: number): number;
  sub(offset: number, length: number): Bytes;
  raw(): Uint8Array;
}

// === server/src/format/regions.ts (declared reads, spec §6.1, §8.4, §8.5)

/** What a decoder declares: a static range, or a range at a pointer's target. */
export type Region =
  | {
      readonly kind: "static";
      readonly at: MemoryAddress;
      readonly length: number;
    }
  | {
      readonly kind: "pointer";
      readonly at: PointerAddress;
      readonly length: number;
    };

export declare function region(at: ProfileAddress, length: number): Region;

/** A decoder part's named regions. Names tie each declaration to the bytes decode() gets. */
export type Regions = Readonly<Record<string, Region>>;
/** The bytes of each named region as read: a slice per name. */
export type Slices<R extends Regions> = { readonly [K in keyof R]: Bytes };

/**
 * Ranges and bytes the largest cycle would send. Pointer words and static regions merge. Each
 * pointer-derived region counts as its own range at full length, since its target is unknown at load.
 */
export declare function measureBatch(
  parts: readonly Regions[],
  mergeGap: number,
): { readonly ranges: number; readonly bytes: number };

// === server/src/format/types.ts (the decoder contract)

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string };
export declare function ok<T>(value: T): Result<T>;
export declare function fail(reason: string): Result<never>;

/** One part of a decoder: what it reads and how it turns those bytes into a value. */
export interface ResourceDecoder<P, R extends Regions, T> {
  /** Every region at its maximum size (full party, all boxes). Same profile, same regions. */
  regions(profile: P): R;
  /** Pure. Returns fail() for expected bad data, such as a checksum mismatch. Throws only on a bug. */
  decode(slices: Slices<R>, ctx: DecodeContext<P>): Result<T>;
}

export type DataFormatId = "gen1" | "gen2" | "gen3" | "cfru";
export type DecoderPart = "party" | "player" | "bag" | "battle" | "boxes";

/**
 * One decoder per data format. A missing part makes that resource 503 `unsupported`
 * (spec §7.2), which lets a format grow part by part during the build.
 */
export interface Decoder<F extends DataFormatId> {
  readonly party?: ResourceDecoder<Profile<F>, Regions, ResourceMap["party"]>;
  readonly player?: ResourceDecoder<Profile<F>, Regions, ResourceMap["player"]>;
  readonly bag?: ResourceDecoder<Profile<F>, Regions, ResourceMap["bag"]>;
  readonly battle?: {
    /** The in-battle flag, read every cycle (spec §8.2). */
    readonly flag: ResourceDecoder<Profile<F>, Regions, boolean>;
    readonly frame: ResourceDecoder<Profile<F>, Regions, BattleFrame>;
  };
  /** Read in the box request, not the main batch (spec §8.3). */
  readonly boxes?: ResourceDecoder<Profile<F>, Regions, ResourceMap["boxes"]>;
}

/** Everything a decoder gets besides its slices. Built once per loaded game. */
export interface DecodeContext<P> {
  readonly profile: P;
  readonly charmap: Charmap;
  readonly names: Names;
  readonly speciesData: SpeciesDataLookup;
  readonly moveData: MoveDataLookup;
  /** Gen 3 and CFRU experience rows. null for Gen 1-2 or a failed hack `exp` table. */
  readonly growth: GrowthCurves | null;
}

export interface Charmap {
  /** Decodes up to the terminator or `maxLength`. Returns UTF-8 text (spec §6.3). */
  decode(bytes: Bytes, maxLength?: number): string;
}

/** null: an ID beyond `count`, an empty entry, a discarded table or no ROM access (spec §5.5). */
export interface Names {
  species(id: number): string | null;
  moves(id: number): string | null;
  items(id: number): string | null;
  abilities(id: number): string | null;
  locations(id: number): string | null;
}

export interface SpeciesInfo {
  readonly genderRatio: number;
  readonly growthRate: number;
  readonly abilities: readonly [number, number];
  /** CFRU only. */
  readonly hiddenAbility: number | null;
  /** Raw type IDs. Each format maps them through its own type table (amendment 016 §3). */
  readonly types: readonly [number, number];
}

/** Each lookup returns null when its table failed or the ID falls outside it (spec §5.6). */
export interface SpeciesDataLookup {
  info(species: number): SpeciesInfo | null;
  dex(species: number): number | null;
}

export interface MoveDataLookup {
  move(id: number): { readonly typeId: number; readonly basePp: number } | null;
}

export interface GrowthCurves {
  readonly maxLevel: number;
  /** The row entry for `rate` at `level`, or null outside the table. */
  expAt(rate: number, level: number): number | null;
}

// === server/src/format/registry.ts (data formats and the support flag, spec §6.1, §12.8)

export interface DataFormat<F extends DataFormatId> {
  readonly id: F;
  readonly platform: Platform;
  readonly generation: 1 | 2 | 3;
  /** The committed support flag. A test allows true only when the support gate passes. */
  readonly supported: boolean;
  readonly decoder: Decoder<F>;
  // In code the module also exports its `addresses` and `constants` Zod blocks,
  // which profile/schema.ts composes (see the rationale).
}

export type DataFormats = { readonly [F in DataFormatId]: DataFormat<F> };
export declare const dataFormats: DataFormats;

// === server/src/profile/types.ts (the resolved profile; in code it is z.output of the full schema)

/** ISO 639-1, every language an official Gen 1-3 game shipped in. A closed enum. */
export type Language = "ja" | "en" | "fr" | "de" | "it" | "es" | "ko";
export type ArtVersion =
  | "red-blue"
  | "red-green-japan"
  | "yellow"
  | "gold"
  | "silver"
  | "crystal"
  | "ruby-sapphire"
  | "emerald"
  | "firered-leafgreen";
export type TableSource = "builtin" | "rom" | "unavailable";

/** Where a profile's data came from (spec §5.1). Never inherited (amendment 018). */
export type Provenance =
  | { readonly kind: "pret"; readonly repo: string; readonly commit: string; readonly symbolFile: string }
  | { readonly kind: "hack-sym"; readonly hack: string; readonly version: string; readonly sha256: string };

export interface RomTable {
  readonly base: ProfileAddress;
  readonly count: number;
}
export interface NameTable extends RomTable {
  readonly stride: number;
  readonly nameOffset: number;
  readonly name:
    | { readonly kind: "inline"; readonly length: number }
    | { readonly kind: "pointer"; readonly maxLength: number };
}
export interface NameTables {
  readonly species: NameTable | "vanilla";
  readonly moves: NameTable | "vanilla";
  readonly items: NameTable | "vanilla";
  readonly abilities: NameTable | "vanilla";
  readonly locations: NameTable | "vanilla";
}
export interface SpeciesDataTables {
  readonly info: RomTable | "vanilla";
  readonly dex: RomTable | "vanilla";
  readonly exp: { readonly base: ProfileAddress; readonly maxLevel: number } | "vanilla";
}

/** One key per address the format's decoder needs. Ticket 005 writes the full Gen 3 list. */
export interface AddressBlocks {
  /** Placeholders. The Gen 1 and Gen 2 tickets type these key sets, as gen3 is typed, before any decoder uses them. */
  gen1: Readonly<Record<string, ProfileAddress>>;
  gen2: Readonly<Record<string, ProfileAddress>>;
  gen3: {
    readonly gPlayerParty: MemoryAddress;
    readonly gPlayerPartyCount: MemoryAddress;
    /** Static on Ruby and Sapphire, a pointer entry on Emerald and FireRed (spec §5.1). */
    readonly gSaveBlock1: ProfileAddress;
    readonly gSaveBlock2: ProfileAddress;
    readonly gPokemonStorage: ProfileAddress;
  };
  cfru: AddressBlocks["gen3"];
}

export interface ProfileBase<F extends DataFormatId> {
  readonly id: string;
  readonly kind: "official" | "hack";
  readonly name: string;
  readonly dataFormat: F;
  readonly language: Language;
  readonly artVersion: ArtVersion;
  readonly identify: Identify | null;
  /** Placeholder. Each format types its own constants block in format/<id>/profile.ts, as with addresses. */
  readonly constants: Readonly<Record<string, number>>;
  /** Required on hacks (spec §5.5, amendment 016 §4). null on an official profile means reference data. */
  readonly nameTables: NameTables | null;
  readonly speciesData: SpeciesDataTables | null;
  readonly moveData: RomTable | "vanilla" | null;
  readonly trainerTables: {
    readonly trainers?: RomTable;
    readonly classNames?: RomTable;
    readonly money?: RomTable;
  };
  /** Resolved with the default by kind (amendment 018 item 5). */
  readonly features: { readonly boxes: boolean };
  readonly fixture: "full" | "smoke" | "none";
  readonly provenance: Provenance | null;
}

export type Profile<F extends DataFormatId = DataFormatId> = F extends DataFormatId
  ? ProfileBase<F> & { readonly addresses: AddressBlocks[F] }
  : never;

export interface Identify {
  readonly sha1: readonly string[];
  readonly crc32: readonly string[];
  readonly header: RomHeader | null;
  readonly signature: ReadonlyArray<{
    readonly at: MemoryAddress;
    readonly bytes: Uint8Array;
  }>;
}

// === server/src/profile/registry.ts (loading, spec §5.2, amendments 018 and 026)

export interface ProfileRegistry {
  get(id: string): Profile | undefined;
  all(): readonly Profile[];
  byHash(hashes: {
    readonly crc32: string | null;
    readonly sha1: string | null;
  }): readonly Profile[];
  byHeader(header: RomHeader): readonly Profile[];
}

export interface ProfileProblem {
  readonly source: "builtin" | "user";
  readonly path: string;
  readonly message: string;
}

/**
 * Loads once at startup into an immutable registry: resolve `extends` in amendment 018's
 * three steps, check the full schema, translate addresses, then check each profile's main
 * batch and box request against BRIDGE_CAPS (amendment 026). Problems never stop the
 * program, and the viewer lists them.
 */
export declare function loadProfiles(input: {
  readonly builtin: readonly unknown[];
  readonly user: ReadonlyArray<{ readonly path: string; readonly json: unknown }>;
  readonly formats: DataFormats;
}): {
  readonly registry: ProfileRegistry;
  readonly problems: readonly ProfileProblem[];
};

// === server/src/loop/job.ts (the shape every multi-step read takes)

/**
 * A multi-step read with no I/O of its own. The read loop drives it through the one request
 * slot: step(null) starts it, and each later call passes the outcome of the ranges the
 * previous step asked for. Identification, ROM-table loading and each read cycle are jobs.
 */
export interface ReadJob<T> {
  step(previous: ReadOutcome | null):
    | { readonly read: readonly Range[] }
    | { readonly done: T };
}

// === server/src/identify/ (spec §5.4, §5.7; ticket 014 owns pick keys and the header timer)

export type RomHeader =
  | {
      readonly platform: "gba";
      readonly title: string;
      readonly gameCode: string;
      readonly revision: number;
    }
  | {
      readonly platform: "gb";
      readonly title: string;
      readonly maskRomVersion: number;
      readonly globalChecksum: number;
    };

export interface ExpansionBlock {
  readonly version: string;
  readonly tagged: boolean;
}

export type Identification =
  | {
      readonly kind: "identified";
      readonly profile: Profile;
      readonly match: "exact" | "header" | "manual";
      readonly signature: "match" | "mismatch" | "unchecked" | null;
      readonly header: RomHeader | null;
      readonly expansion: null;
    }
  | {
      readonly kind: "unidentified";
      readonly reason: "no_match" | "modified" | "expansion" | "other_platform";
      readonly header: RomHeader | null;
      readonly expansion: ExpansionBlock | null;
    };

export interface ManualPicks {
  /** The picked profile ID for this ROM, or null. Keys belong to ticket 014. */
  lookup(game: GameInfo, header: RomHeader | null): string | null;
  /** Remembers the pick for this ROM in manual-picks.json (spec §9.6). */
  set(game: GameInfo, header: RomHeader | null, profileId: string): Promise<void>;
  /** Forgets the pick for this ROM. */
  clear(game: GameInfo, header: RomHeader | null): Promise<void>;
}

/** Everything identification reads, gathered by the identification job. */
export interface IdentifySignals {
  readonly game: GameInfo;
  readonly header: RomHeader | null;
  readonly expansion: ExpansionBlock | null;
  /** Signature bytes per candidate profile ID. null when the words couldn't be read. */
  readonly signatures: ReadonlyMap<string, Uint8Array | null>;
}

/** Pure. The match order and rules of spec §5.4 and §5.7. */
export declare function identify(
  signals: IdentifySignals,
  registry: ProfileRegistry,
  picks: Pick<ManualPicks, "lookup">,
): Identification;

/** Reads the header, the RHHEXP scan window, then candidate signatures, and ends with identify(). */
export declare function identification(
  game: GameInfo,
  registry: ProfileRegistry,
  picks: Pick<ManualPicks, "lookup">,
): ReadJob<Identification>;

// === server/src/reference/index.ts (ticket 019 owns the source and file format)

/** Shipped tables for one data format and language. Charmap, names, species data, move data and growth curves. */
export interface ReferenceData {
  readonly charmap: Charmap;
  readonly names: Omit<Names, "locations">;
  readonly speciesData: SpeciesDataLookup;
  readonly moveData: MoveDataLookup;
  readonly growth: GrowthCurves | null;
}

/** null when v2.0 ships no table for that pair. */
export declare function referenceData(
  format: DataFormatId,
  language: Language,
): ReferenceData | null;

/** One table per game family, chosen by the profile's artVersion (ticket 019). */
export declare function locationNames(
  artVersion: ArtVersion,
  language: Language,
): ((id: number) => string | null) | null;

// === server/src/rom-tables/index.ts (hack ROM tables, spec §5.5, §5.6, amendment 016 §4)

export interface LookupStatus {
  readonly names: {
    readonly species: TableSource;
    readonly moves: TableSource;
    readonly items: TableSource;
    readonly abilities: TableSource | null;
    readonly locations: TableSource | null;
  };
  readonly speciesData: {
    readonly info: TableSource;
    readonly dex: TableSource;
    readonly exp: TableSource;
  };
  readonly moveData: TableSource;
}

export interface GameLookups {
  readonly charmap: Charmap;
  readonly names: Names;
  readonly speciesData: SpeciesDataLookup;
  readonly moveData: MoveDataLookup;
  readonly growth: GrowthCurves | null;
  /** Feeds status.game.names, speciesData and moveData. */
  readonly status: LookupStatus;
}

/**
 * Builds the per-game lookups: reference data for builtin categories, ROM tables for the
 * rest, read in chunks of at most 64 KiB and validated whole. A failed table makes its
 * category unavailable and never holds the state back.
 */
export declare function gameLookups(
  profile: Profile,
  game: GameInfo,
): ReadJob<GameLookups>;

// === server/src/resource/battle-tracker.ts and server/src/resource/registry.ts

/** A decoded battle frame before program-tracked fields. The battle ticket sets its fields. */
export interface BattleFrame {
  readonly standIn: "battle-frame";
}

/** Folds decoded inputs into a value with program-tracked fields. null emits nothing (spec §7.8). */
export interface Tracker<In, Out, S> {
  initial(): S;
  step(state: S, input: In, now: number): {
    readonly state: S;
    readonly value: Out | null;
  };
}

export interface BattleTrackerState {
  /** Goes up each time battle goes active. Resets on a game change (spec §7.8). */
  readonly battleId: number;
  /** Opponent party slots revealed in the current battle. */
  readonly revealed: ReadonlySet<number>;
  /** The last valid active frame, frozen into lastBattle when the flag clears. */
  readonly lastValid: BattleFrame | null;
  readonly lastBattle: StandIn<"last-battle"> | null;
}
export declare const battleTracker: Tracker<
  { readonly inBattle: boolean; readonly frame: BattleFrame | null },
  ResourceMap["battle"],
  BattleTrackerState
>;

/** How each topic gets its value. Keyed by every topic, so a topic missing on either side fails typecheck. */
export type ResourceDefinition<T extends Topic> = T extends "status"
  ? { readonly source: "status" }
  : T extends "battle"
    ? {
        readonly source: "decoder";
        readonly part: "battle";
        readonly request: "main";
        readonly tracker: typeof battleTracker;
      }
    : T extends "boxes"
      ? {
          readonly source: "decoder";
          readonly part: "boxes";
          readonly request: "boxes";
        }
      : T extends DecoderPart
        ? {
            readonly source: "decoder";
            readonly part: T;
            readonly request: "main";
          }
        : never;

export const resources = {
  status: { source: "status" },
  party: { source: "decoder", part: "party", request: "main" },
  player: { source: "decoder", part: "player", request: "main" },
  bag: { source: "decoder", part: "bag", request: "main" },
  battle: {
    source: "decoder",
    part: "battle",
    request: "main",
    tracker: battleTracker,
  },
  boxes: { source: "decoder", part: "boxes", request: "boxes" },
} as const satisfies { readonly [T in Topic]: ResourceDefinition<T> };

// === server/src/resource/status.ts (spec §7.4; ticket 020 owns the unset fields)

export interface StatusInputs {
  readonly adapters: readonly AdapterSummary[];
  readonly identification: Identification | null;
  /** true while ROM tables load. The state stays no_game (spec §5.4). */
  readonly loading: boolean;
  readonly lookups: LookupStatus | null;
  readonly stalled: boolean;
}

export declare function buildStatus(inputs: StatusInputs): Status;

// === server/src/loop/ (the read loop, spec §8)

export type Snapshot<T extends Topic> =
  | { readonly ok: true; readonly value: ResourceMap[T] }
  | { readonly ok: false; readonly code: UnavailableCode; readonly status: Status };

export type ResourceEvent = {
  [T in Topic]: { readonly topic: T; readonly value: ResourceMap[T] };
}[Topic];

/** What the Hono app sees. The read loop is the deep module behind it. */
export interface Resources {
  status(): Status;
  /** Warm: the cached value. Cold: one extra cycle, shared by concurrent callers (spec §8.2). */
  get<T extends Topic>(topic: T): Promise<Snapshot<T>>;
  /** One box (spec §7.9). The 503 checks run first, then the index check (spec §7.2). */
  box(index: number): Promise<
    | { readonly ok: true; readonly box: Box }
    | { readonly ok: false; readonly code: UnavailableCode | "not_found"; readonly status: Status }
  >;
  /** The viewer's adapter list and switch action. Ticket 021 sets their routes. */
  adapters(): readonly AdapterSummary[];
  /** Ticket 021 names the refusal reasons, such as a pinned adapter. */
  switchAdapter(id: AdapterId): { readonly ok: true } | { readonly ok: false; readonly reason: string };
  /** Picks a profile for the loaded ROM, then re-identifies. Ticket 021 sets the routes. */
  pickProfile(
    profileId: string,
  ): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: "no_rom" | "unknown_profile" }>;
  /** Forgets the pick for the loaded ROM, then re-identifies. */
  forgetPick(): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: "no_rom" }>;
  /** On-connect values first, then changes (spec §7.3). The app's SSE queues sit behind this. */
  subscribe(
    topics: readonly Topic[],
    listener: (event: ResourceEvent) => void,
  ): () => void;
}

/**
 * Owns the one request slot and orders main batches, cold reads, box reads, identification
 * and ROM-table loads. Planning, pointer resolution and change detection live inside.
 */
export declare function createReadLoop(deps: {
  readonly selector: AdapterSelector;
  readonly registry: ProfileRegistry;
  readonly formats: DataFormats;
  readonly picks: ManualPicks;
  readonly pollHz: number;
  readonly clock: Clock;
  readonly log: Log;
}): Resources & { close(): Promise<void> };

// === server/src/app/app.ts (Hono, spec §7, §4.11; settings and debug routes come later)

export interface AppDeps {
  readonly resources: Resources;
  /** Generated bridge files by name, from an allowlist (spec §4.11). */
  readonly bridges: Readonly<Record<"mgba" | "bizhawk", string>>;
  readonly debug: boolean;
}

/**
 * In code this returns the zod-openapi `OpenAPIHono` app. It registers one snapshot route per
 * topic with resourceSchemas[topic] as the response schema. Bun.serve takes its fetch.
 */
export declare function createApp(deps: AppDeps): {
  fetch(request: Request): Response | Promise<Response>;
};

// === server/test/support/run-fixture.ts (spec §12)

/**
 * Loads a fixture, takes the profile from its metadata (no identification), treats ROM
 * tables as missing (spec §12.2), and runs the real planner, decoders and trackers through a
 * SliceAdapter. Tests compare the result with the golden.
 */
export declare function runFixture(
  path: string,
  topics?: readonly Topic[],
): Promise<{ readonly [T in Topic]?: ResourceMap[T] }>;
