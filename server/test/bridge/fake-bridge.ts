import type { Domain } from "@pokemon-memory-reader/internal/memory";
import type { Socket, TCPSocketListener } from "bun";
import { FRAME_KIND, PROTOCOL } from "../../src/adapter/bridge/constants";
import {
  decodeReadBody,
  encodeFrame,
  type Frame,
  FrameDecoder,
} from "../../src/adapter/bridge/wire";
import { expectedBytes } from "./lua-bridge";

export const GBA_GAME = {
  platform: "gba",
  romName: "Emerald",
  crc32: "1a2b3c4d",
  sha1: null,
  domains: { rom: 1048576, ewram: 262144, iwram: 32768 },
};

export const HELLO = {
  bridge: "mgba",
  protocol: PROTOCOL,
  build: "test-build",
  emulator: { name: "FakeEmu", version: null },
};

const json = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value));

export interface SeenRead {
  readonly id: number;
  readonly ranges: readonly {
    domain: Domain;
    offset: number;
    length: number;
  }[];
}

/**
 * A TypeScript bridge that speaks the wire protocol for adapter tests. It serves bytes with
 * the same pattern as the Lua fake shim, and lets a test misbehave on purpose.
 */
export class FakeBridge {
  /** What the next connection hears first. Set to null to stay silent. */
  hello: unknown = HELLO;
  /** What the next connection hears right after the hello. Undefined sends nothing. */
  game: unknown = GBA_GAME;
  /** Bytes written in the same chunk as the hello, before any game message. */
  afterHello: Uint8Array | null = null;
  /** Every READ that arrived, in order. */
  readonly reads: SeenRead[] = [];
  /** How to answer a READ. A test replaces it to stay silent, answer late or answer wrongly. */
  onRead: (read: SeenRead, socket: Socket<undefined>) => void = (
    read,
    socket,
  ) => {
    this.reply(socket, read.id, this.dataFor(read));
  };
  connections = 0;
  #listener: TCPSocketListener<undefined> | null = null;
  #sockets = new Set<Socket<undefined>>();
  #port = 0;

  get port(): number {
    return this.#port;
  }

  /** Clients currently connected. */
  get open(): number {
    return this.#sockets.size;
  }

  start(port = 0): void {
    const decoders = new WeakMap<object, FrameDecoder>();
    this.#listener = Bun.listen<undefined>({
      hostname: "127.0.0.1",
      port,
      socket: {
        open: (socket) => {
          this.connections++;
          this.#sockets.add(socket);
          decoders.set(socket, new FrameDecoder());
          if (this.hello === null) return;
          const hello = encodeFrame(FRAME_KIND.HELLO, 0, json(this.hello));
          const tail = this.afterHello ?? new Uint8Array(0);
          const chunk = new Uint8Array(hello.length + tail.length);
          chunk.set(hello);
          chunk.set(tail, hello.length);
          socket.write(chunk);
          if (this.game !== undefined)
            socket.write(encodeFrame(FRAME_KIND.GAME, 0, json(this.game)));
        },
        data: (socket, chunk) => {
          const { frames } = decoders.get(socket)?.push(chunk) ?? {
            frames: [],
          };
          for (const frame of frames) this.#handle(socket, frame);
        },
        close: (socket) => {
          this.#sockets.delete(socket);
        },
        error() {},
      },
    });
    this.#port = this.#listener.port;
  }

  #handle(socket: Socket<undefined>, frame: Frame): void {
    if (frame.kind !== FRAME_KIND.READ) return;
    const decoded = decodeReadBody(frame.body);
    if ("badFrame" in decoded) return;
    const read: SeenRead = {
      id: frame.id,
      ranges: decoded.ranges.map((r) => ({
        domain: r.domain as Domain,
        offset: r.offset,
        length: r.length,
      })),
    };
    this.reads.push(read);
    this.onRead(read, socket);
  }

  dataFor(read: SeenRead): Uint8Array {
    const parts = read.ranges.map((r) =>
      expectedBytes(r.domain, r.offset, r.length),
    );
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const part of parts) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  }

  reply(socket: Socket<undefined>, id: number, body: Uint8Array): void {
    socket.write(encodeFrame(FRAME_KIND.DATA, id, body));
  }

  error(socket: Socket<undefined>, id: number, code: string, message = "x") {
    socket.write(encodeFrame(FRAME_KIND.ERROR, id, json({ code, message })));
  }

  /** Sends to every connected client. */
  broadcast(kind: number, id: number, body: Uint8Array): void {
    for (const socket of this.#sockets)
      socket.write(encodeFrame(kind, id, body));
  }

  sendGame(game: unknown): void {
    this.broadcast(FRAME_KIND.GAME, 0, json(game));
  }

  sendHello(hello: unknown): void {
    this.broadcast(FRAME_KIND.HELLO, 0, json(hello));
  }

  sendError(id: number, code: string, message = "x"): void {
    this.broadcast(FRAME_KIND.ERROR, id, json({ code, message }));
  }

  sendRaw(bytes: Uint8Array): void {
    for (const socket of this.#sockets) socket.write(bytes);
  }

  dropClients(): void {
    for (const socket of [...this.#sockets]) socket.end();
  }

  stop(): void {
    this.dropClients();
    this.#listener?.stop(true);
    this.#listener = null;
  }
}
