import { afterEach, describe, expect, test } from "bun:test";
import type { Socket, TCPSocketListener } from "bun";
import { FRAME_KIND } from "../../src/adapter/bridge/constants";
import { encodeFrame } from "../../src/adapter/bridge/wire";
import {
  BadFrameError,
  connectTestClient,
  type TestClient,
} from "./lua-bridge";

const GOOD = encodeFrame(FRAME_KIND.DATA, 7, Uint8Array.of(1, 2, 3));
/** Kind 99 is outside the frame kind table. */
const BAD = Uint8Array.of(0, 0, 0, 5, 99, 0, 0, 0, 0);

let listener: TCPSocketListener<undefined> | null = null;
let client: TestClient | null = null;

afterEach(() => {
  client?.close();
  client = null;
  listener?.stop(true);
  listener = null;
});

/** Serves `onOpen` writes to the first client, over a real TCP socket. */
async function serve(
  onOpen: (socket: Socket<undefined>) => void | Promise<void>,
): Promise<TestClient> {
  listener = Bun.listen<undefined>({
    hostname: "127.0.0.1",
    port: 0,
    socket: {
      open: (socket) => void onOpen(socket),
      data() {},
      error() {},
    },
  });
  client = await connectTestClient(listener.port);
  return client;
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

describe("a bad frame after a good one over TCP", () => {
  test("in one write: the valid frame arrives, then next() reports the bad frame without a timeout", async () => {
    const c = await serve((socket) => void socket.write(concat(GOOD, BAD)));
    const frame = await c.next();
    expect(frame.kind).toBe(FRAME_KIND.DATA);
    expect(frame.id).toBe(7);
    const started = Date.now();
    const error = await c.next(5000).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadFrameError);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(c.badFrame()).toBe("unknown frame kind 99");
    expect((error as BadFrameError).reason).toBe(c.badFrame() ?? "");
  });

  test("in two writes: next() is already waiting when the bad frame lands", async () => {
    let second!: () => void;
    const gate = new Promise<void>((r) => {
      second = r;
    });
    const c = await serve(async (socket) => {
      socket.write(GOOD);
      socket.flush();
      await gate;
      socket.write(BAD);
    });
    expect((await c.next()).id).toBe(7);
    const waiting = c.next(5000).catch((e: unknown) => e);
    second();
    expect(await waiting).toBeInstanceOf(BadFrameError);
    expect(c.badFrame()).toBe("unknown frame kind 99");
  });

  test("a bad frame split across writes is caught as soon as its kind byte arrives", async () => {
    let second!: () => void;
    const gate = new Promise<void>((r) => {
      second = r;
    });
    const c = await serve(async (socket) => {
      // The length is whole but the kind byte has not arrived, so nothing is wrong yet.
      socket.write(concat(GOOD, BAD.subarray(0, 4)));
      socket.flush();
      await gate;
      // Only the kind byte follows. The rest of the frame never comes.
      socket.write(BAD.subarray(4, 5));
    });
    expect((await c.next()).id).toBe(7);
    expect(await c.maybeNext(30)).toBeNull();
    expect(c.badFrame()).toBeNull();
    second();
    await expect(c.next(5000)).rejects.toBeInstanceOf(BadFrameError);
  });

  test("a valid frame after the bad one is never delivered", async () => {
    const c = await serve(
      (socket) => void socket.write(concat(GOOD, BAD, GOOD)),
    );
    expect((await c.next()).id).toBe(7);
    await expect(c.next(5000)).rejects.toBeInstanceOf(BadFrameError);
    expect(await c.maybeNext(20)).toBeNull();
  });

  test("a plain silence still times out and is not a bad frame", async () => {
    const c = await serve((socket) => void socket.write(GOOD));
    await c.next();
    await expect(c.next(50)).rejects.toThrow("no frame arrived in time");
    expect(c.badFrame()).toBeNull();
  });
});
