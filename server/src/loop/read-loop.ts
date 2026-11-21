import type {
  ResourceMap,
  StatusResource,
  Topic,
} from "@pokemon-memory-reader/api/schemas";
import {
  DEFAULT_POLL_HZ,
  MAX_POLL_HZ,
  MIN_POLL_HZ,
} from "@pokemon-memory-reader/internal/config";
import type { Adapter, ReadOutcome } from "../adapter/types";
import type { Clock } from "../clock";
import { type BoundGame, bindGame } from "../format/registry";
import { type Identification, identification } from "../identify/identify";
import type { Log } from "../log";
import type { ProfileRegistry } from "../profile/registry";
import type { Profile } from "../profile/schema";
import { buildStatus, isUsable } from "../resource/status";
import { runJob } from "./job";
import { PointerCache, readBatch } from "./plan";

/** The 503 codes this server produces (spec §7.2, amendment 020). `not_found` is a 404 and belongs to boxes. */
export type UnavailableCode =
  | "disconnected"
  | "no_game"
  | "unidentified"
  | "unsupported"
  | "no_data";

export type Snapshot<T extends Topic> =
  | { readonly ok: true; readonly value: ResourceMap[T] }
  | {
      readonly ok: false;
      readonly code: UnavailableCode;
      readonly status: StatusResource;
    };

/** What the HTTP app sees. SSE `subscribe`, `box()` and the settings actions join this when their tickets land. */
export interface Resources {
  status(): StatusResource;
  /** Warm: the cached value. Cold: one extra cycle, shared by concurrent callers (spec §8.2). */
  get<T extends Topic>(topic: T): Promise<Snapshot<T>>;
}

export interface ReadLoopDeps {
  /**
   * The live adapter. The adapter selector (spec §3.3) slots in here and the loop reads
   * whichever adapter it makes live.
   */
  readonly adapter: Adapter;
  readonly registry: ProfileRegistry;
  readonly pollHz: number;
  readonly clock: Clock;
  readonly log: Log;
  /** Turns the identified profile into decoders. Tests swap it for a game with pointer regions. */
  readonly bind?: (profile: Profile) => BoundGame;
}

type Decoded = Exclude<Topic, "status">;
const DECODED: readonly Decoded[] = ["party"];

/** A resource is read while it had a GET in the last 5 s (spec §8.2). */
const DEMAND_MS = 5000;
const READ_TIMEOUT_MS = 250;

/** An out-of-range integer clamps to 5-60 and anything else falls back to 20, each with a warning (spec §8.1, §9.2). */
export function normalizePollHz(value: unknown, log: Log): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    log.warn(
      `pollHz ${String(value)} is not an integer, using ${DEFAULT_POLL_HZ}`,
    );
    return DEFAULT_POLL_HZ;
  }
  const clamped = Math.min(MAX_POLL_HZ, Math.max(MIN_POLL_HZ, value));
  if (clamped !== value)
    log.warn(`pollHz ${value} is out of range, using ${clamped}`);
  return clamped;
}

export type ReadLoop = Resources & {
  /** A live `pollHz` change, clamped like the one at startup. */
  setPollHz(hz: number): void;
  close(): Promise<void>;
};

/** Everything that belongs to one game on one connection. Any game change replaces it whole (spec §7.4). */
interface Session {
  readonly epoch: number;
  readonly usable: boolean;
  identification: Identification | null;
  identifying: Promise<void> | null;
  bound: BoundGame | null;
  /** The pointer values the main batch last read (spec §8.5). Empty until the first cycle, so that cycle sends two requests. */
  readonly pointers: PointerCache;
  values: { [T in Decoded]?: ResourceMap[T] };
  demandedAt: Map<Decoded, number>;
  cold: Map<Decoded, Promise<void>>;
}

const sessionFor = (adapter: Adapter): Session => ({
  epoch: adapter.state.gameEpoch,
  usable: isUsable(adapter.state),
  identification: null,
  identifying: null,
  bound: null,
  pointers: new PointerCache(),
  values: {},
  demandedAt: new Map(),
  cold: new Map(),
});

/**
 * Owns the one request slot (spec §4.5) and orders identification, the tick cycle and cold
 * reads through it. Change detection and `stalled` (spec §8.6), SSE demand (spec §8.2) and box
 * requests (spec §8.3) slot in here.
 */
export function createReadLoop(deps: ReadLoopDeps): ReadLoop {
  const { adapter, registry, clock, log } = deps;
  const bind = deps.bind ?? bindGame;
  const intervalFor = (hz: number) =>
    Math.max(1000 / normalizePollHz(hz, log), adapter.limits.minIntervalMs);
  let intervalMs = intervalFor(deps.pollHz);

  let session = sessionFor(adapter);
  let slot: Promise<unknown> = Promise.resolve();
  let cancelTick: (() => void) | null = null;
  let closed = false;

  /** One request at a time: each task starts when the one before it has settled. */
  function exclusive<T>(task: () => Promise<T>): Promise<T> {
    const next = slot.then(task);
    slot = next.catch(() => {});
    return next;
  }

  const read = (ranges: Parameters<Adapter["read"]>[0]): Promise<ReadOutcome> =>
    adapter.read(ranges, READ_TIMEOUT_MS);

  function identify(current: Session): Promise<void> {
    const game = adapter.state.game;
    if (current.identification !== null || !current.usable || game === null)
      return Promise.resolve();
    current.identifying ??= exclusive(async () => {
      if (current !== session) return;
      const found = await runJob(identification(game, registry), read);
      if (current !== session || found === null) return;
      current.identification = found;
      current.bound = found.kind === "identified" ? bind(found.profile) : null;
      if (found.kind === "unidentified")
        log.info(`ROM not identified (${found.reason})`);
    })
      .catch((error) => log.error("identification failed", { error }))
      .finally(() => {
        current.identifying = null;
      });
    return current.identifying;
  }

  /** One batched read for these topics, decoded into the session's values. */
  function cycle(current: Session, topics: readonly Decoded[]): Promise<void> {
    return exclusive(async () => {
      const bound = current.bound;
      if (current !== session || bound === null) return;
      const parts = topics.flatMap((topic) => {
        const part = bound[topic];
        return part ? [{ topic, part }] : [];
      });
      if (parts.length === 0) return;
      const game = adapter.state.game;
      if (game === null || game.platform === "other") return;
      const result = await runJob(
        readBatch(
          parts.map(({ part }) => part.regions),
          {
            mergeGap: adapter.limits.mergeGap,
            platform: game.platform,
            pointers: current.pointers,
          },
        ),
        read,
      );
      // A timeout or a failed read keeps the last value. `stalled` counts the timeouts here.
      if (current !== session || result.kind !== "sample") return;
      for (const { topic, part } of parts) {
        const sliced = result.sample.slices(part.regions);
        if (!sliced.ok) {
          log.debug(`${topic} skipped this cycle: ${sliced.reason}`);
          continue;
        }
        try {
          const decoded = part.decode(sliced.slices);
          if (decoded.ok) current.values[topic] = decoded.value as never;
          else log.debug(`${topic} did not decode: ${decoded.reason}`);
        } catch (error) {
          log.error(`${topic} decoder threw, which is a layout bug`, { error });
        }
      }
    }).catch((error) => log.error("read cycle failed", { error }));
  }

  const demanded = (current: Session): Decoded[] =>
    DECODED.filter(
      (topic) =>
        clock.now() - (current.demandedAt.get(topic) ?? -Infinity) <= DEMAND_MS,
    );

  async function work(): Promise<void> {
    const current = session;
    if (!current.usable) return;
    if (current.identification === null) return identify(current);
    const topics = demanded(current);
    if (topics.length > 0) await cycle(current, topics);
  }

  function tick(): void {
    if (closed) return;
    const started = clock.now();
    void work()
      .catch((error) => log.error("tick failed", { error }))
      .finally(() => {
        if (closed) return;
        // A cycle that overruns skips the missed ticks and never queues (spec §8.1).
        const wait = Math.max(0, intervalMs - (clock.now() - started));
        cancelTick = clock.setTimeout(tick, wait);
      });
  }

  const stopListening = adapter.subscribe((state) => {
    if (state.gameEpoch === session.epoch && isUsable(state) === session.usable)
      return;
    session = sessionFor(adapter);
    void identify(session);
  });
  void identify(session);
  tick();

  const status = (): StatusResource =>
    buildStatus({
      adapterId: adapter.id,
      adapter: adapter.state,
      identification: session.identification,
    });

  /** The first 503 that applies, checked in the order of amendment 020 §3, without `no_data`. */
  function unavailable(
    current: Session,
    topic: Decoded,
  ): UnavailableCode | null {
    if (!current.usable) return "disconnected";
    if (adapter.state.game === null || current.identification === null)
      return "no_game";
    if (current.identification.kind === "unidentified") return "unidentified";
    if (current.bound?.[topic] === undefined) return "unsupported";
    return null;
  }

  async function get<T extends Topic>(topic: T): Promise<Snapshot<T>> {
    if (topic === "status") return { ok: true, value: status() } as Snapshot<T>;
    const wanted = topic as Decoded;
    const current = session;
    const code = unavailable(current, wanted);
    const refuse = (why: UnavailableCode): Snapshot<T> => ({
      ok: false,
      code: why,
      status: status(),
    });
    if (code !== null) return refuse(code);

    const warm =
      clock.now() - (current.demandedAt.get(wanted) ?? -Infinity) <= DEMAND_MS;
    current.demandedAt.set(wanted, clock.now());
    if (!warm || current.values[wanted] === undefined) {
      // A cold GET runs one extra cycle at once, shared by GETs that arrive together (spec §8.2).
      let run = current.cold.get(wanted);
      if (run === undefined) {
        delete current.values[wanted];
        run = cycle(current, [wanted]).finally(() => {
          current.cold.delete(wanted);
        });
        current.cold.set(wanted, run);
      }
      await run;
    }
    if (current !== session)
      return refuse(unavailable(session, wanted) ?? "no_data");
    const value = current.values[wanted];
    if (value === undefined) return refuse("no_data");
    return { ok: true, value } as Snapshot<T>;
  }

  return {
    status,
    get,
    /** Takes effect from the next tick (spec §9.4). */
    setPollHz(hz) {
      intervalMs = intervalFor(hz);
    },
    async close() {
      closed = true;
      cancelTick?.();
      stopListening();
      await slot;
    },
  };
}
