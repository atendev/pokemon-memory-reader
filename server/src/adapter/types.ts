import type { Domain, Platform } from "@pokemon-memory-reader/internal/memory";
import type { Clock } from "../clock";
import type { Log } from "../log";

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
  /** RetroArch's content name, the file name without its extension (amendment 014). Only the RetroArch adapter sets it. */
  readonly contentName?: string | null;
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

/** A probe that got no answer: nothing listening (`refused`) or silence (`no_reply`), and when it ended. */
export interface ProbeMiss {
  readonly kind: "refused" | "no_reply";
  readonly at: number;
}

/** What the selector uses. One long-lived instance per configured emulator. */
export interface ManagedAdapter extends Adapter {
  readonly id: AdapterId;
  /** mgba 0, retroarch 1, bizhawk 2 (spec §3.3). */
  readonly priority: number;
  /**
   * The last probe that ended without an answer, for an adapter whose state can't show it (RetroArch,
   * where a miss changes nothing). null after a probe that answered. Bridge adapters leave it out.
   */
  readonly lastMiss?: ProbeMiss | null;
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
