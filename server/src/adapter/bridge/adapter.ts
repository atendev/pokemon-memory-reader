import type { Socket } from "bun";
import type {
  AdapterDeps,
  AdapterMode,
  AdapterState,
  BridgeHello,
  Endpoint,
  GameInfo,
  ManagedAdapter,
  Range,
  ReadOutcome,
} from "../types";
import { BRIDGE_CAPS, FRAME_KIND } from "./constants";
import {
  checkHello,
  decodeJsonBody,
  type ErrorCode,
  type GameBody,
  parseError,
  parseGame,
} from "./messages";
import {
  createRequestIds,
  encodeFrame,
  encodeReadBody,
  type Frame,
  FrameDecoder,
} from "./wire";

export interface BridgeAdapterOptions {
  /** How long a connection waits for the hello before `unknown_bridge` (spec §4.7). Default 3000. */
  readonly helloTimeoutMs?: number;
  /** First reconnect delay, doubled after each failed attempt up to `maxBackoffMs`. Default 500. */
  readonly baseBackoffMs?: number;
  /** Default 5000. */
  readonly maxBackoffMs?: number;
}

const DEFAULT_HELLO_TIMEOUT_MS = 3000;
const DEFAULT_BASE_BACKOFF_MS = 500;
const DEFAULT_MAX_BACKOFF_MS = 5000;
const ERROR_LOG_INTERVAL_MS = 60_000;
const KEEPALIVE_DELAY_MS = 10_000;

interface Connection {
  readonly decoder: FrameDecoder;
  readonly nextId: () => number;
  socket: Socket | null;
  /** Bytes a partial write left behind. */
  unsent: Uint8Array;
  helloDone: boolean;
  helloTimer: (() => void) | null;
  closed: boolean;
}

interface Inflight {
  readonly id: number;
  readonly lengths: readonly number[];
  readonly connection: Connection;
  /** The read's promise was already settled (timeout, or a game message overtook it). The reply only frees the slot. */
  settled: boolean;
  settle(outcome: PartOutcome): void;
  cancelTimeout: () => void;
}

type PartOutcome =
  | { readonly kind: "data"; readonly body: Uint8Array }
  | { readonly kind: "timeout" }
  | { readonly kind: "failed"; readonly reason: FailedReason };

type FailedReason = Extract<ReadOutcome, { kind: "failed" }>["reason"];

interface Part {
  readonly ranges: Range[];
  /** For each range in `ranges`, the index of the caller's range and the offset inside it. */
  readonly targets: { index: number; at: number }[];
}

/** One bridge adapter: the connection to an mGBA or BizHawk bridge (spec §3.1, §4). */
export function createBridgeAdapter(
  bridge: "mgba" | "bizhawk",
  endpoint: Endpoint,
  deps: AdapterDeps,
  options: BridgeAdapterOptions = {},
): ManagedAdapter {
  const { clock, log } = deps;
  const helloTimeoutMs = options.helloTimeoutMs ?? DEFAULT_HELLO_TIMEOUT_MS;
  const baseBackoffMs = options.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
  const maxBackoffMs = options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;

  let state: AdapterState = {
    connection: "disconnected",
    bridge: null,
    problem: null,
    game: null,
    gameEpoch: 0,
  };
  const listeners = new Set<(state: AdapterState) => void>();
  let mode: AdapterMode = "probe";
  let current: Connection | null = null;
  let inflight: Inflight | null = null;
  let reading = false;
  let shutDown = false;
  let cancelRetry: (() => void) | null = null;
  let backoffMs = baseBackoffMs;
  const lastErrorLog = new Map<string, number>();

  function update(change: Partial<AdapterState>): void {
    const next = { ...state, ...change };
    const same =
      next.connection === state.connection &&
      next.bridge === state.bridge &&
      next.problem === state.problem &&
      next.game === state.game &&
      next.gameEpoch === state.gameEpoch;
    if (same) return;
    state = next;
    for (const listener of [...listeners]) listener(state);
  }

  function setGame(game: GameInfo | null): void {
    if (game === null && state.game === null) return;
    update({ game, gameEpoch: state.gameEpoch + 1 });
  }

  function logLimited(
    code: string,
    message: string,
    level: "warn" | "error" = "warn",
    fields: Record<string, unknown> = {},
  ): void {
    const now = clock.now();
    const last = lastErrorLog.get(code);
    if (last !== undefined && now - last < ERROR_LOG_INTERVAL_MS) return;
    lastErrorLog.set(code, now);
    log[level](message, { code, ...fields });
  }

  // --- connecting ---

  function scheduleRetry(): void {
    if (shutDown || cancelRetry !== null) return;
    const delay = backoffMs;
    backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
    cancelRetry = clock.setTimeout(() => {
      cancelRetry = null;
      connect();
    }, delay);
  }

  function connect(): void {
    if (shutDown || current !== null) return;
    const connection: Connection = {
      decoder: new FrameDecoder(),
      nextId: createRequestIds(),
      socket: null,
      unsent: new Uint8Array(0),
      helloDone: false,
      helloTimer: null,
      closed: false,
    };
    current = connection;
    update({ connection: "connecting" });
    const handlers = {
      open(socket: Socket) {
        if (connection.closed) {
          socket.end();
          return;
        }
        connection.socket = socket;
        socket.setKeepAlive?.(true, KEEPALIVE_DELAY_MS);
        connection.helloTimer = clock.setTimeout(() => {
          connection.helloTimer = null;
          if (connection.helloDone) return;
          // The socket stays open: a paused emulator answers after unpause (spec §4.7).
          update({ problem: "unknown_bridge", bridge: null });
        }, helloTimeoutMs);
      },
      data(_socket: Socket, chunk: Uint8Array) {
        if (connection.closed) return;
        onData(connection, chunk);
      },
      drain() {
        flush(connection);
      },
      close() {
        onClosed(connection);
      },
      error() {},
      connectError() {
        onClosed(connection, true);
      },
    };
    Bun.connect({
      hostname: endpoint.host,
      port: endpoint.port,
      socket: handlers,
    }).catch(() => onClosed(connection, true));
  }

  function closeConnection(connection: Connection): void {
    if (connection.closed) return;
    connection.socket?.end();
    onClosed(connection);
  }

  function onClosed(connection: Connection, refused = false): void {
    if (connection.closed) return;
    connection.closed = true;
    connection.helloTimer?.();
    connection.helloTimer = null;
    if (current !== connection) return;
    current = null;
    if (inflight?.connection === connection) {
      const dead = inflight;
      inflight = null;
      dead.cancelTimeout();
      if (!dead.settled) {
        dead.settled = true;
        dead.settle({ kind: "failed", reason: "disconnected" });
      }
    }
    // A refused connect is not a problem: nothing is listening (spec §4.7).
    update({
      connection: "disconnected",
      ...(refused ? { problem: null, bridge: null } : {}),
    });
    setGame(null);
    scheduleRetry();
  }

  // --- sending ---

  function send(connection: Connection, bytes: Uint8Array): void {
    if (connection.closed || connection.socket === null) return;
    if (connection.unsent.length > 0) {
      const joined = new Uint8Array(connection.unsent.length + bytes.length);
      joined.set(connection.unsent);
      joined.set(bytes, connection.unsent.length);
      connection.unsent = joined;
      return;
    }
    const written = connection.socket.write(bytes);
    if (written < bytes.length) connection.unsent = bytes.slice(written);
  }

  function flush(connection: Connection): void {
    if (connection.closed || connection.socket === null) return;
    if (connection.unsent.length === 0) return;
    const written = connection.socket.write(connection.unsent);
    connection.unsent = connection.unsent.slice(written);
  }

  // --- receiving ---

  function onData(connection: Connection, chunk: Uint8Array): void {
    const { frames, badFrame } = connection.decoder.push(chunk);
    for (const frame of frames) {
      if (connection.closed) return;
      if (!connection.helloDone) {
        onFirstFrame(connection, frame);
      } else {
        onFrame(connection, frame);
      }
    }
    if (connection.closed) return;
    if (badFrame !== null) {
      log.warn("bad frame from the bridge", { reason: badFrame });
      if (connection.helloDone) {
        update({ problem: "bridge_error" });
      } else {
        update({ problem: "unknown_bridge", bridge: null });
      }
      closeConnection(connection);
      return;
    }
    decideAfterFrames(connection);
  }

  /** Spec §4.7: a probe closes right after the hello, whatever it says, unless the adapter went live or `hold` first. */
  function decideAfterFrames(connection: Connection): void {
    if (!connection.helloDone || connection.closed) return;
    const problem = state.problem;
    // The socket stays open with no reads until a valid game message (spec §4.7).
    if (problem === "bridge_error") return;
    if (problem === "protocol_mismatch" && mode === "hold") return;
    if (problem === null && mode !== "probe") return;
    closeConnection(connection);
  }

  function onFirstFrame(connection: Connection, frame: Frame): void {
    const fail = (message: string) => {
      log.warn(message);
      update({ problem: "unknown_bridge", bridge: null });
      closeConnection(connection);
    };
    if (frame.kind !== FRAME_KIND.HELLO) {
      fail("the first frame from the bridge was not a hello");
      return;
    }
    let value: unknown;
    try {
      value = decodeJsonBody(frame.body);
    } catch {
      fail("the bridge's hello is not valid JSON");
      return;
    }
    const checked = checkHello(value);
    if (checked.kind === "unknown_bridge") {
      fail("the bridge's hello failed validation");
      return;
    }
    connection.helloDone = true;
    connection.helloTimer?.();
    connection.helloTimer = null;
    if (checked.kind === "protocol_mismatch") {
      log.warn("bridge protocol mismatch", {
        bridge: checked.bridge,
        protocol: checked.protocol,
      });
      update({
        connection: "connected",
        problem: "protocol_mismatch",
        bridge: {
          bridge: checked.bridge,
          protocol: checked.protocol,
          build: null,
          emulator: null,
        },
      });
      return;
    }
    const hello: BridgeHello = checked.hello;
    if (hello.bridge !== bridge) {
      log.warn("a different bridge answered on this endpoint", {
        expected: bridge,
        answered: hello.bridge,
      });
      update({
        connection: "connected",
        problem: "unknown_bridge",
        bridge: hello,
      });
      return;
    }
    log.info("bridge hello", { bridge: hello.bridge, build: hello.build });
    // bridge_error from an earlier connection stays until a valid game message (spec §4.7).
    update({
      connection: "connected",
      bridge: hello,
      problem: state.problem === "bridge_error" ? "bridge_error" : null,
    });
    // Only a live connection earns a quick reconnect. Probes keep backing off (spec §4.7).
    if (mode === "live") backoffMs = baseBackoffMs;
  }

  function onFrame(connection: Connection, frame: Frame): void {
    switch (frame.kind) {
      case FRAME_KIND.GAME:
        onGame(frame);
        return;
      case FRAME_KIND.DATA:
        onDataFrame(connection, frame);
        return;
      case FRAME_KIND.ERROR:
        onError(frame);
        return;
      case FRAME_KIND.HELLO:
        log.warn("a second hello arrived on an open connection");
        return;
      default:
        // READ never goes bridge to program.
        log.warn("unexpected frame kind from the bridge", { kind: frame.kind });
        update({ problem: "bridge_error" });
        closeConnection(connection);
    }
  }

  function onGame(frame: Frame): void {
    let value: unknown;
    try {
      value = decodeJsonBody(frame.body);
    } catch {
      value = undefined;
    }
    const game: GameBody | null | undefined =
      value === undefined ? undefined : parseGame(value);
    if (game === undefined) {
      log.warn("the bridge sent a game message that failed validation");
      update({ problem: "bridge_error" });
      return;
    }
    // Replies to requests sent before this message are dropped (spec §4.3).
    if (inflight && !inflight.settled) {
      inflight.settled = true;
      inflight.cancelTimeout();
      inflight.settle({ kind: "failed", reason: "dropped" });
    }
    const info: GameInfo | null =
      game === null
        ? null
        : {
            platform: game.platform,
            crc32: game.crc32,
            sha1: game.sha1,
            romName: game.romName,
            domains: game.domains,
          };
    log.info("game message", {
      romName: game?.romName ?? null,
      crc32: game?.crc32 ?? null,
    });
    update({
      game: info,
      gameEpoch: state.gameEpoch + 1,
      problem: state.problem === "bridge_error" ? null : state.problem,
    });
  }

  function onDataFrame(connection: Connection, frame: Frame): void {
    if (
      !inflight ||
      inflight.connection !== connection ||
      inflight.id !== frame.id
    ) {
      log.warn("dropped a DATA reply that matches no pending request", {
        id: frame.id,
      });
      return;
    }
    const pending = inflight;
    inflight = null;
    pending.cancelTimeout();
    if (pending.settled) return;
    pending.settled = true;
    const expected = pending.lengths.reduce((sum, n) => sum + n, 0);
    if (frame.body.length !== expected) {
      log.warn("dropped a DATA reply of the wrong length", {
        expected,
        got: frame.body.length,
      });
      pending.settle({ kind: "failed", reason: "dropped" });
      return;
    }
    pending.settle({ kind: "data", body: frame.body });
  }

  function onError(frame: Frame): void {
    let body: ReturnType<typeof parseError>;
    try {
      body = parseError(decodeJsonBody(frame.body));
    } catch {
      body = parseError(null);
    }
    const code: ErrorCode = body.code;
    if (frame.id === 0) {
      if (code === "busy") {
        update({ problem: "busy" });
      } else {
        logLimited(code, `the bridge sent ${code}: ${body.message}`);
      }
      return;
    }
    if (!inflight || inflight.id !== frame.id) {
      logLimited(
        code,
        `dropped an ERROR that matches no pending request (${code})`,
      );
      return;
    }
    const pending = inflight;
    inflight = null;
    pending.cancelTimeout();
    if (pending.settled) return;
    pending.settled = true;
    if (code === "no_game") {
      setGame(null);
      pending.settle({ kind: "failed", reason: "no_game" });
      return;
    }
    logLimited(
      code,
      `the bridge answered a read with ${code}: ${body.message}`,
    );
    pending.settle({ kind: "failed", reason: "bridge_error" });
  }

  // --- reading ---

  /** Packs every RAM range into the first request, then fills with ROM ranges, splitting those that don't fit (spec §4.4). Null when the RAM ranges alone break the caps. */
  function plan(
    ranges: readonly Range[],
    valid: readonly boolean[],
  ): Part[] | null {
    const first: Part = { ranges: [], targets: [] };
    let bytes = 0;
    ranges.forEach((range, index) => {
      if (!valid[index] || range.domain === "rom") return;
      first.ranges.push(range);
      first.targets.push({ index, at: 0 });
      bytes += range.length;
    });
    if (
      first.ranges.length > BRIDGE_CAPS.maxRanges ||
      bytes > BRIDGE_CAPS.maxBytes
    ) {
      return null;
    }
    const parts: Part[] = [first];
    let part = first;
    ranges.forEach((range, index) => {
      if (!valid[index] || range.domain !== "rom") return;
      let at = 0;
      while (at < range.length || (range.length === 0 && at === 0)) {
        if (
          part.ranges.length >= BRIDGE_CAPS.maxRanges ||
          bytes >= BRIDGE_CAPS.maxBytes
        ) {
          part = { ranges: [], targets: [] };
          parts.push(part);
          bytes = 0;
        }
        const take = Math.min(range.length - at, BRIDGE_CAPS.maxBytes - bytes);
        part.ranges.push({
          domain: "rom",
          offset: range.offset + at,
          length: take,
        });
        part.targets.push({ index, at });
        bytes += take;
        at += take;
        if (range.length === 0) break;
      }
    });
    return parts.filter((p) => p.ranges.length > 0);
  }

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

  function request(
    connection: Connection,
    ranges: readonly Range[],
    timeoutMs: number,
  ): Promise<PartOutcome> {
    return new Promise<PartOutcome>((resolve) => {
      const id = connection.nextId();
      const pending: Inflight = {
        id,
        lengths: ranges.map((r) => r.length),
        connection,
        settled: false,
        settle: resolve,
        cancelTimeout: () => {},
      };
      pending.cancelTimeout = clock.setTimeout(() => {
        if (pending.settled) return;
        // The request stays unanswered until its late reply arrives (spec §4.5).
        pending.settled = true;
        resolve({ kind: "timeout" });
      }, timeoutMs);
      inflight = pending;
      send(
        connection,
        encodeFrame(FRAME_KIND.READ, id, encodeReadBody(ranges)),
      );
    });
  }

  async function read(
    ranges: readonly Range[],
    timeoutMs: number,
  ): Promise<ReadOutcome> {
    if (reading)
      throw new Error("the bridge adapter allows one read at a time");
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
    const connection = current;
    if (
      mode !== "live" ||
      connection === null ||
      connection.closed ||
      !connection.helloDone ||
      state.problem !== null ||
      state.bridge === null
    ) {
      return { kind: "failed", reason: "disconnected" };
    }
    // A timed-out request is still unanswered: send nothing (spec §4.5).
    if (inflight !== null) return { kind: "timeout" };
    const game = state.game;
    if (game === null) return { kind: "failed", reason: "no_game" };
    const valid = ranges.map((range) => inBounds(range, game));
    const parts = plan(ranges, valid);
    if (parts === null) {
      // A bug, not a stall cause: the program logs it once a minute (amendment 026).
      logLimited("over_caps", "a RAM read is over the bridge caps", "error", {
        ranges: ranges.length,
        bytes: ranges.reduce((sum, range) => sum + range.length, 0),
      });
      return { kind: "timeout" };
    }
    const epoch = state.gameEpoch;
    const slices: (Uint8Array | null)[] = ranges.map((range, i) =>
      valid[i] ? new Uint8Array(range.length) : null,
    );
    for (const part of parts) {
      if (current !== connection || connection.closed) {
        return { kind: "failed", reason: "disconnected" };
      }
      if (state.gameEpoch !== epoch)
        return { kind: "failed", reason: "dropped" };
      if (part.ranges.length === 0) continue;
      const outcome = await request(connection, part.ranges, timeoutMs);
      if (outcome.kind !== "data") return outcome;
      let at = 0;
      part.ranges.forEach((range, i) => {
        const target = part.targets[i];
        const slice = target && slices[target.index];
        if (target && slice) {
          slice.set(outcome.body.subarray(at, at + range.length), target.at);
        }
        at += range.length;
      });
    }
    return { kind: "data", slices };
  }

  // --- the ManagedAdapter surface ---

  const adapter: ManagedAdapter = {
    id: bridge,
    priority: bridge === "mgba" ? 0 : 2,
    limits: { minIntervalMs: 0, mergeGap: BRIDGE_CAPS.mergeGap },
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
      if (next === "live" && current?.helloDone && state.problem === null) {
        backoffMs = baseBackoffMs;
      }
      if (current === null) {
        // Don't wait out a long backoff once someone wants the adapter.
        if (next !== "probe" && cancelRetry !== null) {
          cancelRetry();
          cancelRetry = null;
          connect();
        }
        return;
      }
      if (next === "probe") decideAfterFrames(current);
    },
    async close() {
      if (shutDown) return;
      shutDown = true;
      cancelRetry?.();
      cancelRetry = null;
      const connection = current;
      if (connection) closeConnection(connection);
      listeners.clear();
    },
  };

  connect();
  return adapter;
}
