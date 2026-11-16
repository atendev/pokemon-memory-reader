import { resolve } from "node:path";
import type { Domain } from "@pokemon-memory-reader/internal/memory";
import type { TCPSocketListener } from "bun";
import { DOMAIN_CODES } from "../../src/adapter/bridge/constants";
import { type Frame, FrameDecoder } from "../../src/adapter/bridge/wire";

const HARNESS = resolve(import.meta.dir, "../../../bridges/test/harness.lua");

const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

/** The byte the fake shim serves at `offset` of `domain`. */
export function expectedByte(domain: Domain, offset: number): number {
  return (offset * 7 + DOMAIN_CODES[domain]) % 256;
}

export function expectedBytes(
  domain: Domain,
  offset: number,
  length: number,
): Uint8Array {
  return Uint8Array.from({ length }, (_, i) =>
    expectedByte(domain, offset + i),
  );
}

/** Thrown by `next()` when the stream broke and no valid frame is left to deliver. */
export class BadFrameError extends Error {
  constructor(readonly reason: string) {
    super(`bad frame: ${reason}`);
  }
}

/** A frame stream read from one TCP client. */
export interface TestClient {
  readonly closed: Promise<void>;
  send(bytes: Uint8Array): void;
  /** Frames parsed before a bad frame are delivered first. Then it throws `BadFrameError` at once, not after the timeout. */
  next(timeoutMs?: number): Promise<Frame>;
  /** Waits for a frame, or returns null if none arrives within the timeout or the stream broke. */
  maybeNext(timeoutMs: number): Promise<Frame | null>;
  badFrame(): string | null;
  close(): void;
}

/** Connects a TCP client that decodes the frames a bridge sends. */
export async function connectTestClient(port: number): Promise<TestClient> {
  const decoder = new FrameDecoder();
  const frames: Frame[] = [];
  let bad: string | null = null;
  let wake: (() => void) | null = null;
  let closedResolve!: () => void;
  const closed = new Promise<void>((r) => {
    closedResolve = r;
  });
  const socket = await Bun.connect({
    hostname: "127.0.0.1",
    port,
    socket: {
      data(_s, chunk) {
        const result = decoder.push(chunk);
        frames.push(...result.frames);
        if (result.badFrame !== null) bad = result.badFrame;
        wake?.();
      },
      close() {
        closedResolve();
        wake?.();
      },
      error() {},
    },
  });
  const maybeNext = async (timeoutMs: number): Promise<Frame | null> => {
    const deadline = Date.now() + timeoutMs;
    while (frames.length === 0 && bad === null) {
      const left = deadline - Date.now();
      if (left <= 0) return null;
      await new Promise<void>((r) => {
        wake = r;
        setTimeout(r, left);
      });
    }
    return frames.shift() ?? null;
  };
  return {
    closed,
    send: (bytes) => void socket.write(bytes),
    maybeNext,
    next: async (timeoutMs = 2000) => {
      const frame = await maybeNext(timeoutMs);
      if (frame) return frame;
      if (bad !== null) throw new BadFrameError(bad);
      throw new Error("no frame arrived in time");
    },
    badFrame: () => bad,
    close: () => socket.end(),
  };
}

/**
 * Runs the Lua protocol core with the fake shim as a child process, in lockstep over
 * stdin and stdout. Real TCP connections to `port` are relayed to it as the shim's sockets,
 * because stock Lua has no sockets of its own.
 */
export class LuaBridge {
  readonly logs: string[] = [];
  port = 0;
  #proc: ReturnType<typeof Bun.spawn<"pipe", "pipe", "inherit">>;
  #reader: { read(): Promise<{ value?: Uint8Array; done: boolean }> };
  #pending = "";
  #queue: Promise<unknown> = Promise.resolve();
  #nextId = 1;
  #sockets = new Map<
    number,
    { write(data: Uint8Array): number; end(): void }
  >();
  #server: TCPSocketListener<undefined> | null = null;
  #timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.#proc = Bun.spawn([process.env.LUA_BIN ?? "lua", HARNESS], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "inherit",
    });
    this.#reader = this.#proc.stdout.getReader();
  }

  async #readLine(): Promise<string> {
    for (;;) {
      const at = this.#pending.indexOf("\n");
      if (at >= 0) {
        const line = this.#pending.slice(0, at);
        this.#pending = this.#pending.slice(at + 1);
        return line;
      }
      const { value, done } = await this.#reader.read();
      if (done) throw new Error("the Lua harness exited");
      this.#pending += new TextDecoder().decode(value);
    }
  }

  /** Runs one harness command and routes its output. Commands run one at a time. */
  command(line: string): Promise<string[]> {
    const run = async () => {
      this.#proc.stdin.write(`${line}\n`);
      this.#proc.stdin.flush();
      const lines: string[] = [];
      for (;;) {
        const out = await this.#readLine();
        if (out === "done") break;
        lines.push(out);
        this.#route(out);
      }
      return lines;
    };
    const result = this.#queue.then(run, run);
    this.#queue = result.catch(() => {});
    return result;
  }

  #route(line: string): void {
    const [kind, id, hex] = line.split(" ");
    if (kind === "fatal") throw new Error(`Lua harness: ${line}`);
    if (kind === "log") this.logs.push(line.slice(4));
    if (kind === "send")
      this.#sockets.get(Number(id))?.write(Buffer.from(hex ?? "", "hex"));
    if (kind === "close") {
      this.#sockets.get(Number(id))?.end();
      this.#sockets.delete(Number(id));
    }
  }

  async start(): Promise<void> {
    const ids = new WeakMap<object, number>();
    const server = Bun.listen<undefined>({
      hostname: "127.0.0.1",
      port: 0,
      socket: {
        open: (socket) => {
          const id = this.#nextId++;
          ids.set(socket, id);
          this.#sockets.set(id, socket);
          void this.command(`open ${id}`);
        },
        data: (socket, data) => {
          void this.command(`data ${ids.get(socket)} ${toHex(data)}`);
        },
        close: (socket) => {
          const id = ids.get(socket);
          if (id === undefined || !this.#sockets.has(id)) return;
          this.#sockets.delete(id);
          void this.command(`peerclose ${id}`);
        },
      },
    });
    this.#server = server;
    this.port = server.port;
    // The emulator's frame callback: step often, and once now so it binds.
    this.#timer = setInterval(
      () => void this.command("step").catch(() => {}),
      5,
    );
    await this.command("step");
  }

  /** Connects a real TCP client to the relay. */
  connect(): Promise<TestClient> {
    return connectTestClient(this.port);
  }

  async stop(): Promise<void> {
    if (this.#timer) clearInterval(this.#timer);
    this.#server?.stop(true);
    await this.#queue;
    this.#proc.stdin.write("quit\n");
    this.#proc.stdin.flush();
    await this.#proc.exited;
  }
}
