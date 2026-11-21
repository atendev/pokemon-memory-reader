import type { Platform } from "@pokemon-memory-reader/internal/memory";
import { headerRange } from "../../identify/header";
import type {
  AdapterDeps,
  AdapterMode,
  AdapterState,
  Endpoint,
  GameInfo,
  ManagedAdapter,
  Range,
  ReadOutcome,
} from "../types";
import {
  type Chunk,
  DOMAIN_SIZES,
  parseRead,
  parseStatus,
  planChunks,
  platformOf,
  readCommand,
  type StatusReply,
} from "./protocol";

export interface RetroArchAdapterOptions {
  /** How long the probe waits for a `GET_STATUS` reply (amendment 026, point 2). Default 1000. */
  readonly probeTimeoutMs?: number;
  /** First re-probe delay, doubled after each failed attempt up to `maxBackoffMs`. Default 500. */
  readonly baseBackoffMs?: number;
  /** Default 5000. */
  readonly maxBackoffMs?: number;
  /** No reply for this long disconnects a live adapter (spec §8.6). Default 30000. */
  readonly disconnectMs?: number;
  /** `romCheckIntervalMs` (amendment 014, item 6). Default 2000. */
  readonly romCheckIntervalMs?: number;
}

const DEFAULT_PROBE_TIMEOUT_MS = 1000;
const DEFAULT_BASE_BACKOFF_MS = 500;
const DEFAULT_MAX_BACKOFF_MS = 5000;
const DEFAULT_DISCONNECT_MS = 30_000;
const DEFAULT_ROM_CHECK_MS = 2000;
/** The live adapter asks `GET_STATUS` at most this often, alongside a batch (amendment 026, point 4). */
const STATUS_INTERVAL_MS = 1000;
/** How long one step of the ROM check waits for its reply. */
const CHECK_TIMEOUT_MS = 1000;

type Slot = Uint8Array | null;

/** One datagram waiting for its reply. A batch and a ROM check can wait on the same address. */
interface Waiter {
  readonly chunk: Chunk;
  settle(slot: Slot): void;
}

interface UdpSocket {
  send(data: string): boolean;
  close(): void;
}

/** The RetroArch adapter: `GET_STATUS` and `READ_CORE_MEMORY` over UDP (spec §3.4, amendments 026 and 014). */
export function createRetroArchAdapter(
  endpoint: Endpoint,
  deps: AdapterDeps,
  options: RetroArchAdapterOptions = {},
): ManagedAdapter {
  const { clock, log } = deps;
  const probeTimeoutMs = options.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const baseBackoffMs = options.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
  const maxBackoffMs = options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
  const disconnectMs = options.disconnectMs ?? DEFAULT_DISCONNECT_MS;
  const romCheckMs = options.romCheckIntervalMs ?? DEFAULT_ROM_CHECK_MS;

  let state: AdapterState = {
    connection: "disconnected",
    bridge: null,
    problem: null,
    game: null,
    gameEpoch: 0,
  };
  const listeners = new Set<(state: AdapterState) => void>();
  let mode: AdapterMode = "probe";
  let phase: "idle" | "probing" | "up" = "idle";
  let shutDown = false;
  let socket: UdpSocket | null = null;
  let socketOpening = false;
  let reading = false;
  let backoffMs = baseBackoffMs;
  let cancelRetry: (() => void) | null = null;
  let cancelProbe: (() => void) | null = null;
  let cancelWatchdog: (() => void) | null = null;
  let cancelCheck: (() => void) | null = null;
  let lastStatusSent = Number.NEGATIVE_INFINITY;
  const pending = new Set<Waiter>();
  let statusWaiters: ((reply: StatusReply) => void)[] = [];
  /** What the last status said, so a change in system, name or hash shows up (amendment 014, item 6). */
  let statusKey = "none";
  /** The header bytes at the last ROM check. undefined until the first check reads them. */
  let headerKey: string | undefined;
  let badStatusLogged = false;
  let shortLogged = false;

  function update(change: Partial<AdapterState>): void {
    const next = { ...state, ...change };
    if (
      next.connection === state.connection &&
      next.game === state.game &&
      next.gameEpoch === state.gameEpoch
    )
      return;
    state = next;
    for (const listener of [...listeners]) listener(state);
  }

  function setGame(game: GameInfo | null): void {
    if (game === null && state.game === null) return;
    update({ game, gameEpoch: state.gameEpoch + 1 });
  }

  function gameFrom(reply: StatusReply): GameInfo | null {
    if (reply.kind !== "content") return null;
    const platform = platformOf(reply.systemId);
    if (platform === "other") return null;
    return {
      platform,
      crc32: reply.crc32,
      sha1: null,
      romName: reply.contentName,
      contentName: reply.contentName,
      domains: DOMAIN_SIZES[platform],
    };
  }

  function keyOf(reply: StatusReply): string {
    if (reply.kind !== "content" || platformOf(reply.systemId) === "other")
      return "none";
    return [reply.systemId, reply.contentName, reply.crc32].join("|");
  }

  // --- connecting ---

  function scheduleRetry(): void {
    if (shutDown || cancelRetry !== null) return;
    const delay = backoffMs;
    backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
    cancelRetry = clock.setTimeout(() => {
      cancelRetry = null;
      void probe();
    }, delay);
  }

  async function ensureSocket(): Promise<UdpSocket | null> {
    if (socket !== null) return socket;
    if (socketOpening) return null;
    socketOpening = true;
    try {
      const opened = await Bun.udpSocket({
        connect: { hostname: endpoint.host, port: endpoint.port },
        socket: {
          data(_socket, data) {
            onDatagram(new TextDecoder().decode(data));
          },
          // An ICMP port-unreachable lands here: nothing is listening (amendment 026, point 2).
          error() {
            if (phase === "probing") failProbe();
          },
        },
      });
      if (shutDown) {
        opened.close();
        return null;
      }
      socket = {
        send: (data) => opened.send(data),
        close: () => opened.close(),
      };
      return socket;
    } catch (error) {
      log.warn("the RetroArch socket failed to open", { error });
      return null;
    } finally {
      socketOpening = false;
    }
  }

  async function probe(): Promise<void> {
    if (shutDown || phase !== "idle") return;
    phase = "probing";
    const open = await ensureSocket();
    if (shutDown) return;
    if (open === null) {
      failProbe();
      return;
    }
    cancelProbe = clock.setTimeout(failProbe, probeTimeoutMs);
    send("GET_STATUS");
  }

  /** No reply, or nothing listening. Not a problem: the adapter stays disconnected (spec §4.7). */
  function failProbe(): void {
    if (phase !== "probing") return;
    cancelProbe?.();
    cancelProbe = null;
    phase = "idle";
    scheduleRetry();
  }

  function onProbeOk(reply: StatusReply): void {
    cancelProbe?.();
    cancelProbe = null;
    phase = "up";
    badStatusLogged = false;
    shortLogged = false;
    statusKey = keyOf(reply);
    headerKey = undefined;
    const game = gameFrom(reply);
    update({
      connection: "connected",
      ...(game ? { game, gameEpoch: state.gameEpoch + 1 } : {}),
    });
    // The listener may have set live or hold. Otherwise the probe is done and RetroArch is
    // probed again on the backoff, as a bridge connection is.
    if (phase === "up" && mode === "probe") goIdle();
    else if (phase === "up") applyMode();
  }

  /** Back to disconnected. Both a closed probe and a lost connection end here. */
  function goIdle(): void {
    if (phase === "up" || phase === "probing") phase = "idle";
    cancelWatchdog?.();
    cancelWatchdog = null;
    cancelCheck?.();
    cancelCheck = null;
    for (const waiter of [...pending]) waiter.settle(null);
    pending.clear();
    statusWaiters = [];
    update({ connection: "disconnected" });
    setGame(null);
    scheduleRetry();
  }

  function applyMode(): void {
    if (phase !== "up") return;
    if (mode === "live") {
      backoffMs = baseBackoffMs;
      armWatchdog();
      if (cancelCheck === null) scheduleCheck();
    } else {
      cancelWatchdog?.();
      cancelWatchdog = null;
      cancelCheck?.();
      cancelCheck = null;
    }
  }

  function armWatchdog(): void {
    cancelWatchdog?.();
    cancelWatchdog = clock.setTimeout(() => {
      cancelWatchdog = null;
      log.warn("RetroArch sent no reply for 30 s, so it is disconnected");
      goIdle();
    }, disconnectMs);
  }

  // --- sending and receiving ---

  function send(text: string): void {
    socket?.send(text);
  }

  function sendStatus(): void {
    lastStatusSent = clock.now();
    send("GET_STATUS");
  }

  function onDatagram(text: string): void {
    if (shutDown) return;
    if (phase === "up" && mode === "live") armWatchdog();
    const status = parseStatus(text);
    if (status !== null) {
      // GET_STATUS ERROR isn't a valid probe reply (amendment 026, point 1).
      if (phase === "probing") {
        if (status.kind !== "error") onProbeOk(status);
      } else if (phase === "up") onStatus(status);
      return;
    }
    if (text.startsWith("GET_STATUS ")) {
      if (!badStatusLogged) {
        badStatusLogged = true;
        log.warn("RetroArch sent a GET_STATUS reply the adapter can't read", {
          reply: text.slice(0, 120),
        });
      }
      return;
    }
    if (phase !== "up") return;
    const read = parseRead(text);
    if (read !== null) onRead(read);
  }

  function onStatus(reply: StatusReply): void {
    const waiters = statusWaiters;
    statusWaiters = [];
    for (const waiter of waiters) waiter(reply);
    // Content that isn't being played, or that the program doesn't read, ends the game now.
    // Any other change waits for the ROM check, which reads the header too (amendment 014).
    if (reply.kind !== "error" && keyOf(reply) === "none") {
      statusKey = "none";
      setGame(null);
    }
  }

  function onRead(reply: NonNullable<ReturnType<typeof parseRead>>): void {
    const at = [...pending].filter(
      (waiter) => waiter.chunk.address === reply.address,
    );
    if (reply.kind === "error") {
      for (const waiter of at) waiter.settle(null);
      return;
    }
    const count = reply.bytes.length;
    // The echoed address and the byte count pick the chunk. A short reply fails the shortest
    // chunk it can't fill, and a longer one than any asked for matches nothing (amendment 026).
    const exact = at.filter((waiter) => waiter.chunk.length === count);
    if (exact.length > 0) {
      for (const waiter of exact) waiter.settle(reply.bytes);
      return;
    }
    const longer = at
      .filter((waiter) => waiter.chunk.length > count)
      .sort((a, b) => a.chunk.length - b.chunk.length)[0];
    if (longer === undefined) return;
    if (!shortLogged) {
      shortLogged = true;
      log.warn("RetroArch answered a read with fewer bytes than asked", {
        address: reply.address,
        asked: longer.chunk.length,
        got: count,
      });
    }
    longer.settle(null);
  }

  /** Sends the datagrams and waits for every reply, or the timeout. */
  function exchange(
    chunks: readonly Chunk[],
    timeoutMs: number,
  ): Promise<{ complete: boolean; slots: Slot[] }> {
    return new Promise((resolve) => {
      const slots: Slot[] = chunks.map(() => null);
      if (chunks.length === 0) {
        resolve({ complete: true, slots });
        return;
      }
      const waiters: Waiter[] = [];
      let remaining = chunks.length;
      const finish = (complete: boolean) => {
        cancel();
        for (const waiter of waiters) pending.delete(waiter);
        resolve({ complete, slots });
      };
      const cancel = clock.setTimeout(() => finish(false), timeoutMs);
      chunks.forEach((chunk, i) => {
        let done = false;
        const waiter: Waiter = {
          chunk,
          settle(slot) {
            if (done) return;
            done = true;
            slots[i] = slot;
            remaining--;
            pending.delete(waiter);
            if (remaining === 0) finish(true);
          },
        };
        waiters.push(waiter);
        pending.add(waiter);
      });
      for (const chunk of chunks) send(readCommand(chunk));
    });
  }

  // --- the ROM check (amendment 014, item 6) ---

  function scheduleCheck(): void {
    cancelCheck = clock.setTimeout(() => {
      cancelCheck = null;
      void runCheck().finally(() => {
        if (phase === "up" && mode === "live" && cancelCheck === null)
          scheduleCheck();
      });
    }, romCheckMs);
  }

  function askStatus(): Promise<StatusReply | null> {
    return new Promise((resolve) => {
      const cancel = clock.setTimeout(() => {
        statusWaiters = statusWaiters.filter((w) => w !== waiter);
        resolve(null);
      }, CHECK_TIMEOUT_MS);
      const waiter = (reply: StatusReply) => {
        cancel();
        resolve(reply);
      };
      statusWaiters.push(waiter);
      sendStatus();
    });
  }

  async function readHeader(platform: Platform): Promise<string | null> {
    const range = headerRange(platform);
    const plan = planChunks(platform, [range], [true]);
    const { complete, slots } = await exchange(plan.chunks, CHECK_TIMEOUT_MS);
    if (!complete) return null;
    const slot = slots[0];
    return slot ? Buffer.from(slot).toString("hex") : "unmapped";
  }

  /**
   * Reads `GET_STATUS` and the header, and starts a new game when system, name, hash or header
   * bytes differ from the last check. A timeout or an error reply changes nothing.
   */
  async function runCheck(): Promise<void> {
    const epoch = state.gameEpoch;
    const reply = await askStatus();
    if (reply === null || reply.kind === "error" || phase !== "up") return;
    const game = gameFrom(reply);
    let header: string | undefined;
    if (game !== null) {
      const read = await readHeader(game.platform as Platform);
      if (read === null || phase !== "up") return;
      header = read;
    }
    if (state.gameEpoch !== epoch) return;
    const key = keyOf(reply);
    const changed =
      key !== statusKey ||
      (headerKey !== undefined && header !== undefined && header !== headerKey);
    statusKey = key;
    headerKey = header;
    if (changed) {
      log.info("RetroArch content changed", {
        contentName: game?.contentName ?? null,
      });
      if (game === null) setGame(null);
      else update({ game, gameEpoch: state.gameEpoch + 1 });
    }
  }

  // --- reads ---

  function inBounds(range: Range, game: GameInfo): boolean {
    const size = game.domains[range.domain];
    return (
      size !== undefined &&
      Number.isInteger(range.offset) &&
      Number.isInteger(range.length) &&
      range.offset >= 0 &&
      range.length >= 0 &&
      range.offset + range.length <= size
    );
  }

  async function read(
    ranges: readonly Range[],
    timeoutMs: number,
  ): Promise<ReadOutcome> {
    if (reading)
      throw new Error("the RetroArch adapter allows one read at a time");
    reading = true;
    try {
      return await readNow(ranges, timeoutMs);
    } finally {
      reading = false;
    }
  }

  async function readNow(
    ranges: readonly Range[],
    timeoutMs: number,
  ): Promise<ReadOutcome> {
    if (mode !== "live" || phase !== "up")
      return { kind: "failed", reason: "disconnected" };
    const game = state.game;
    if (game === null) return { kind: "failed", reason: "no_game" };
    const platform = game.platform as Platform;
    const valid = ranges.map((range) => inBounds(range, game));
    const plan = planChunks(platform, ranges, valid);
    const epoch = state.gameEpoch;
    if (clock.now() - lastStatusSent >= STATUS_INTERVAL_MS) sendStatus();
    const { complete, slots } = await exchange(plan.chunks, timeoutMs);
    if (phase !== "up") return { kind: "failed", reason: "disconnected" };
    if (state.gameEpoch !== epoch) return { kind: "failed", reason: "dropped" };
    // One missing reply makes the whole batch a timeout (amendment 026, point 5).
    if (!complete) return { kind: "timeout" };
    const out: Slot[] = ranges.map((range, i) => {
      const parts = plan.pieces[i];
      if (!parts) return null;
      const slice = new Uint8Array(range.length);
      for (const part of parts) {
        const bytes = slots[part.chunk];
        if (!bytes) return null;
        slice.set(bytes.subarray(0, part.length), part.at);
      }
      return slice;
    });
    return { kind: "data", slices: out };
  }

  // --- the ManagedAdapter surface ---

  const adapter: ManagedAdapter = {
    id: "retroarch",
    priority: 1,
    // The adapter spike may raise these (spec §15).
    limits: { minIntervalMs: 0, mergeGap: 32 },
    get state() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    read,
    setMode(next) {
      if (shutDown || next === mode) return;
      mode = next;
      if (phase === "up") {
        if (next === "probe") goIdle();
        else applyMode();
        return;
      }
      // Don't wait out a long backoff once someone wants the adapter.
      if (next !== "probe" && phase === "idle" && cancelRetry !== null) {
        cancelRetry();
        cancelRetry = null;
        void probe();
      }
    },
    async close() {
      if (shutDown) return;
      shutDown = true;
      cancelRetry?.();
      cancelProbe?.();
      cancelWatchdog?.();
      cancelCheck?.();
      phase = "idle";
      for (const waiter of [...pending]) waiter.settle(null);
      pending.clear();
      socket?.close();
      socket = null;
      listeners.clear();
    },
  };

  void probe();
  return adapter;
}
