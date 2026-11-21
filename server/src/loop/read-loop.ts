import { createHash } from "node:crypto";
import type {
  Box,
  Boxes,
  ResourceMap,
  StatusResource,
  Topic,
} from "@pokemon-memory-reader/api/schemas";
import {
  DEFAULT_POLL_HZ,
  MAX_POLL_HZ,
  MIN_POLL_HZ,
} from "@pokemon-memory-reader/internal/config";
import type { Platform } from "@pokemon-memory-reader/internal/memory";
import type { Adapter, ReadOutcome } from "../adapter/types";
import type { Clock } from "../clock";
import type { Bytes } from "../format/bytes";
import { unreadableBoxes } from "../format/gen3/box";
import { type BoundGame, type BoundPart, bindGame } from "../format/registry";
import type { BattleProbe } from "../format/types";
import { type Identification, identification } from "../identify/identify";
import type { Log } from "../log";
import type { ProfileRegistry } from "../profile/registry";
import type { Profile } from "../profile/schema";
import {
  type BattleTick,
  type BattleTrackerState,
  battleTracker,
} from "../resource/battle-tracker";
import { createBoxCorruptionLog } from "../resource/box-corruption";
import { buildStatus, isUsable } from "../resource/status";
import { runJob } from "./job";
import { PointerCache, readBatch } from "./plan";

/** The 503 codes this server produces (spec §7.2, amendment 020). `not_found` is a 404 and belongs to `box()`. */
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

/** `GET /boxes/:n`: the 503 codes of any resource, then a 404 for an `n` that names no box (amendment 020 §3). */
export type BoxSnapshot =
  | { readonly ok: true; readonly value: Box }
  | {
      readonly ok: false;
      readonly code: UnavailableCode | "not_found";
      readonly status: StatusResource;
    };

/** What the HTTP app sees. SSE `subscribe` and the settings actions join this when their tickets land. */
export interface Resources {
  status(): StatusResource;
  /**
   * Warm: the cached value. Cold: one extra cycle, shared by concurrent callers (spec §8.2).
   * `boxes` has its own rules (spec §8.3): a cache over 1 s old is read again at once, and a read
   * that times out leaves the stale cache.
   */
  get<T extends Topic>(topic: T): Promise<Snapshot<T>>;
  /** One box by its 0-based index, as the raw `:n` of the route. */
  box(n: string): Promise<BoxSnapshot>;
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
/** The topics the main batch reads. `boxes` has its own request (spec §8.3). */
type MainTopic = Exclude<Decoded, "boxes">;

/** One decoder part a cycle reads, and where its decoded value goes. */
interface Part {
  readonly name: string;
  readonly part: BoundPart<unknown>;
  accept(value: unknown): void;
}
const DECODED: readonly MainTopic[] = ["party", "player", "battle"];

/** A resource is read while it had a GET in the last 5 s (spec §8.2). */
const DEMAND_MS = 5000;
const READ_TIMEOUT_MS = 250;
/** Boxes are read at most this often (`boxesMinIntervalMs`, spec §8.3), and a cache older than this is stale. */
const BOXES_MIN_INTERVAL_MS = 1000;
/** The box request's own timeout. It never counts toward `stalled` (spec §8.3, §8.6). */
const BOX_TIMEOUT_MS = 1000;
/** How long a GET waits for the read it triggered before it falls back to the stale cache (spec §8.3). */
const BOX_GET_WAIT_MS = 2250;

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

/** The box resource of one session. Its pointer cache belongs to the box request alone (spec §8.5). */
interface BoxState {
  readonly pointers: PointerCache;
  readonly corruption: ReturnType<typeof createBoxCorruptionLog>;
  value: Boxes | undefined;
  /** Hash of the raw bytes the cached value came from, or `UNREADABLE`. A read with the same hash keeps the value. */
  hash: string | null;
  /** When the last read that gave a result finished. The cache is stale 1 s after it. */
  readAt: number;
  /** When the last read started, whatever it gave. Ticks read again no sooner than 1 s after it. */
  startedAt: number;
  /** The read a stale GET triggered, shared by GETs that arrive while it runs. */
  triggered: Promise<void> | null;
}

/** The hash a value built from a storage block that couldn't be read gets. */
const UNREADABLE = "unreadable";

/** Everything that belongs to one game on one connection. Any game change replaces it whole (spec §7.4). */
interface Session {
  readonly epoch: number;
  readonly usable: boolean;
  identification: Identification | null;
  identifying: Promise<void> | null;
  bound: BoundGame | null;
  /** The pointer values the main batch last read (spec §8.5). Empty until the first cycle, so that cycle sends two requests. */
  readonly pointers: PointerCache;
  values: { [T in MainTopic]?: ResourceMap[T] };
  boxes: BoxState;
  /** The battle tracker's state. A new session starts it over, so a game change resets `battleId` and `lastBattle` (spec §7.8). */
  battle: BattleTrackerState;
  /** True from the cycle that read the in-battle flag set until one reads it clear, so the frame is read while a battle runs (spec §8.2). */
  battleOn: boolean;
  demandedAt: Map<Decoded, number>;
  cold: Map<MainTopic, Promise<void>>;
}

const sessionFor = (adapter: Adapter, log: Log): Session => ({
  epoch: adapter.state.gameEpoch,
  usable: isUsable(adapter.state),
  identification: null,
  identifying: null,
  bound: null,
  pointers: new PointerCache(),
  values: {},
  boxes: {
    pointers: new PointerCache(),
    corruption: createBoxCorruptionLog(log),
    value: undefined,
    hash: null,
    readAt: -Infinity,
    startedAt: -Infinity,
    triggered: null,
  },
  battle: battleTracker.initial(),
  battleOn: false,
  demandedAt: new Map(),
  cold: new Map(),
});

/**
 * Owns the one request slot (spec §4.5) and orders identification, the tick cycle and cold
 * reads through it. Change detection and `stalled` (spec §8.6) and SSE demand (spec §8.2) slot in
 * here. Box requests (spec §8.3) run after the main batch, in their own request.
 */
export function createReadLoop(deps: ReadLoopDeps): ReadLoop {
  const { adapter, registry, clock, log } = deps;
  const bind = deps.bind ?? bindGame;
  const intervalFor = (hz: number) =>
    Math.max(1000 / normalizePollHz(hz, log), adapter.limits.minIntervalMs);
  let intervalMs = intervalFor(deps.pollHz);

  let session = sessionFor(adapter, log);
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
  const readBox = (
    ranges: Parameters<Adapter["read"]>[0],
  ): Promise<ReadOutcome> => adapter.read(ranges, BOX_TIMEOUT_MS);

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

  /** Feeds one battle read to the tracker. True when the flag read set but the frame wasn't read, so the frame is read at once. */
  function feedBattle(current: Session, read: BattleProbe): boolean {
    if (read.flag === "set" && !("frame" in read)) {
      current.battleOn = true;
      return true;
    }
    current.battleOn = read.flag === "set";
    const step = battleTracker.step(
      current.battle,
      read as BattleTick,
      clock.now(),
    );
    current.battle = step.state;
    for (const warning of step.warnings) log.warn(warning);
    if (step.value !== null) current.values.battle = step.value;
    return false;
  }

  /** One batched read for these parts, each decoded value handed to its `accept`. */
  async function readParts(
    current: Session,
    platform: Platform,
    parts: readonly Part[],
  ): Promise<void> {
    const result = await runJob(
      readBatch(
        parts.map(({ part }) => part.regions),
        {
          mergeGap: adapter.limits.mergeGap,
          platform,
          pointers: current.pointers,
        },
      ),
      read,
    );
    // A timeout or a failed read keeps the last value. `stalled` counts the timeouts here.
    if (current !== session || result.kind !== "sample") return;
    for (const { name, part, accept } of parts) {
      const sliced = result.sample.slices(part.regions);
      if (!sliced.ok) {
        log.debug(`${name} skipped this cycle: ${sliced.reason}`);
        continue;
      }
      try {
        const decoded = part.decode(sliced.slices);
        if (decoded.ok) accept(decoded.value);
        else log.debug(`${name} did not decode: ${decoded.reason}`);
      } catch (error) {
        log.error(`${name} decoder threw, which is a layout bug`, { error });
      }
    }
  }

  /**
   * One batched read for these topics and the in-battle flag, decoded into the session's values.
   * The flag is read every cycle with the outcome beside it. While it is set the cycle reads the
   * whole frame, and a flag that reads set after a clear read gets its frame in a second request
   * straight away, so a battle shows within the tick (spec §8.2, §8.6).
   */
  function cycle(
    current: Session,
    topics: readonly MainTopic[],
  ): Promise<void> {
    return exclusive(async () => {
      const bound = current.bound;
      if (current !== session || bound === null) return;
      const game = adapter.state.game;
      if (game === null || game.platform === "other") return;
      const parts: Part[] = topics.flatMap((topic) => {
        const part =
          topic === "party" || topic === "player" ? bound[topic] : undefined;
        return part
          ? [
              {
                name: topic,
                part,
                accept: (value: unknown) => {
                  current.values[topic] = value as never;
                },
              },
            ]
          : [];
      });
      const battle = bound.battle;
      let frameNeeded = false;
      if (battle) {
        parts.push({
          name: "battle",
          part: current.battleOn ? battle.frame : battle.probe,
          accept: (value) => {
            frameNeeded = feedBattle(current, value as BattleProbe);
          },
        });
      }
      if (parts.length === 0) return;
      await readParts(current, game.platform, parts);
      if (battle && frameNeeded && current === session) {
        await readParts(current, game.platform, [
          {
            name: "battle",
            part: battle.frame,
            accept: (value) => {
              feedBattle(current, value as BattleProbe);
            },
          },
        ]);
      }
    }).catch((error) => log.error("read cycle failed", { error }));
  }

  const isDemanded = (current: Session, topic: Decoded): boolean =>
    clock.now() - (current.demandedAt.get(topic) ?? -Infinity) <= DEMAND_MS;

  const demanded = (current: Session): MainTopic[] =>
    DECODED.filter((topic) => isDemanded(current, topic));

  /** Raw bytes of every region read, so a block that didn't change isn't decoded again (spec §7.9). */
  const hashOf = (slices: Readonly<Record<string, Bytes>>): string => {
    const hash = createHash("sha1");
    for (const name of Object.keys(slices).sort()) {
      hash.update(name).update(slices[name]?.raw() ?? new Uint8Array());
    }
    return hash.digest("hex");
  };

  /**
   * One box request, after the main batch and in its own call with its own timeout (spec §8.3).
   * A tick read is skipped when the last one started under a second ago. A forced read, which a
   * stale GET triggers, is skipped when a read finished while it waited for the slot and the cache
   * is fresh again. A timeout or a failed read keeps the cache and never counts toward `stalled`.
   */
  function readBoxes(current: Session, forced: boolean): Promise<void> {
    return exclusive(async () => {
      const bound = current.bound?.boxes;
      const game = adapter.state.game;
      if (current !== session || bound === undefined) return;
      if (game === null || game.platform === "other") return;
      const state = current.boxes;
      const now = clock.now();
      // A forced read waits out the interval too, so a read that failed fast (a moved pointer)
      // isn't retried by every GET inside the second (spec §8.3).
      if (
        now - state.startedAt < BOXES_MIN_INTERVAL_MS ||
        (forced && isFresh(state))
      )
        return;
      state.startedAt = now;
      const result = await runJob(
        readBatch([bound.regions], {
          mergeGap: adapter.limits.mergeGap,
          platform: game.platform,
          pointers: state.pointers,
        }),
        readBox,
      );
      if (current !== session || result.kind !== "sample") return;
      const sliced = result.sample.slices(bound.regions);
      if (!sliced.ok) {
        // The pointer moved under the read, or it never read: the bytes are stale, so try again next time.
        if (
          sliced.reason === "pointer_moved" ||
          sliced.reason === "pointer_unread"
        )
          return;
        // The storage block itself couldn't be read, so every box is unreadable (spec §7.9).
        log.debug(`boxes unreadable: ${sliced.reason}`);
        keepBoxes(current, UNREADABLE, unreadableBoxes());
        return;
      }
      const hash = hashOf(sliced.slices);
      if (hash === state.hash) {
        state.readAt = clock.now();
        return;
      }
      try {
        const decoded = bound.decode(sliced.slices);
        if (decoded.ok) keepBoxes(current, hash, decoded.value);
        else log.debug(`boxes did not decode: ${decoded.reason}`);
      } catch (error) {
        log.error("boxes decoder threw, which is a layout bug", { error });
      }
    }).catch((error) => log.error("box read failed", { error }));
  }

  const isFresh = (state: BoxState): boolean =>
    state.value !== undefined &&
    clock.now() - state.readAt <= BOXES_MIN_INTERVAL_MS;

  /** Caches a box value whose bytes changed. */
  function keepBoxes(current: Session, hash: string, value: Boxes): void {
    const state = current.boxes;
    state.readAt = clock.now();
    if (hash === state.hash) return;
    state.hash = hash;
    state.value = value;
    state.corruption.report(value);
    // SSE slot: the `boxes` topic pushes `value` to its subscribers from here, at most once a
    // second (spec §7.9, §8.3). It waits for the SSE ticket (071).
  }

  /**
   * The cached boxes, read again first when the cache is over 1 s old. The wait is bounded, and
   * a read that doesn't finish in time leaves the stale cache, or nothing on a first read.
   */
  async function freshBoxes(current: Session): Promise<Boxes | undefined> {
    const state = current.boxes;
    current.demandedAt.set("boxes", clock.now());
    if (!isFresh(state)) {
      state.triggered ??= readBoxes(current, true).finally(() => {
        state.triggered = null;
      });
      const run = state.triggered;
      await new Promise<void>((resolve) => {
        const cancel = clock.setTimeout(resolve, BOX_GET_WAIT_MS);
        void run.then(() => {
          cancel();
          resolve();
        });
      });
    }
    return state.value;
  }

  async function work(): Promise<void> {
    const current = session;
    if (!current.usable) return;
    if (current.identification === null) return identify(current);
    const topics = demanded(current);
    // The in-battle flag is read every tick, whether or not anything is demanded (spec §8.2).
    if (topics.length > 0 || current.bound?.battle)
      await cycle(current, topics);
    // The main batch is decoded before the box request starts (spec §8.3).
    if (current.bound?.boxes && isDemanded(current, "boxes"))
      await readBoxes(current, false);
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
    session = sessionFor(adapter, log);
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
    if (wanted === "boxes") {
      const value = await freshBoxes(current);
      if (current !== session)
        return refuse(unavailable(session, wanted) ?? "no_data");
      return value === undefined
        ? refuse("no_data")
        : ({ ok: true, value } as Snapshot<T>);
    }

    const warm = isDemanded(current, wanted);
    current.demandedAt.set(wanted, clock.now());
    // The flag read keeps `battle` current, so only a missing value needs a cold cycle.
    if (
      (!warm && wanted !== "battle") ||
      current.values[wanted] === undefined
    ) {
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

  /** `:n` is checked after the state codes and before any read, so a bad `n` never starts one (amendment 020 §3). */
  async function box(n: string): Promise<BoxSnapshot> {
    const current = session;
    const refuse = (code: UnavailableCode | "not_found"): BoxSnapshot => ({
      ok: false,
      code,
      status: status(),
    });
    const code = unavailable(current, "boxes");
    if (code !== null) return refuse(code);
    const index = /^(0|[1-9]\d*)$/.test(n) ? Number(n) : -1;
    if (index < 0 || index >= (current.bound?.boxes?.count ?? 0))
      return refuse("not_found");
    const value = await freshBoxes(current);
    if (current !== session)
      return refuse(unavailable(session, "boxes") ?? "no_data");
    const found = value?.boxes[index];
    return found === undefined ? refuse("no_data") : { ok: true, value: found };
  }

  return {
    status,
    get,
    box,
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
