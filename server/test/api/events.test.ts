import { afterEach, describe, expect, test } from "bun:test";
import { connect, type Socket } from "node:net";
import type { Topic } from "@pokemon-memory-reader/api/schemas";
import { createApp } from "../../src/app/app";
import {
  createStreamHub,
  HEARTBEAT_MS,
  SLOW_CLIENT_MS,
} from "../../src/app/stream";
import type { BoundGame } from "../../src/format/registry";
import { ok } from "../../src/format/types";
import { silentLog } from "../../src/log";
import {
  type ChangeEvent,
  createReadLoop,
  type StreamSource,
} from "../../src/loop/read-loop";
import emerald from "../../src/profile/builtin/emerald-us-1.0.json";
import { loadProfiles } from "../../src/profile/registry";
import { ManualClock } from "../bridge/manual-clock";
import { ScriptedAdapter } from "../support/scripted-adapter";

const { registry } = loadProfiles({ builtin: [emerald], user: [] });

const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};

const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const undo of cleanup.splice(0).reverse()) await undo();
});

/** A party of byte 0 empty mons at EWRAM 0x5000, and no other topic bound. */
const AT = 0x5000;
const sized = (): BoundGame => ({
  party: {
    regions: {
      body: {
        kind: "static",
        at: { domain: "ewram", offset: AT },
        length: 2,
      },
    },
    decode: (slices) =>
      ok({ pokemon: new Array(slices.body?.u8(0) ?? 0).fill({}) } as never),
  },
});

function serveApp(source: StreamSource, clock: ManualClock, resources: never) {
  const hub = createStreamHub({ source, clock, log: silentLog });
  const app = createApp({ resources, stream: hub });
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (request, bunServer) => app.fetch(request, bunServer),
  });
  cleanup.push(() => {
    hub.close();
    return server.stop(true);
  });
  return { hub, server, url: `http://127.0.0.1:${server.port}/api/v2/events` };
}

/** Reads frames off a response body until `done` accepts what has arrived, or fails after 5 s. */
async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  done: (text: string) => boolean,
): Promise<string> {
  const decoder = new TextDecoder();
  let text = "";
  const deadline = Date.now() + 5000;
  while (!done(text)) {
    if (Date.now() > deadline) throw new Error(`timed out; got: ${text}`);
    const next = await Promise.race([
      reader.read(),
      new Promise<null>((r) => setTimeout(() => r(null), 250)),
    ]);
    if (next === null) continue;
    if (next.done) break;
    text += decoder.decode(next.value, { stream: true });
  }
  return text;
}

describe("GET /api/v2/events against a running server", () => {
  test("on-connect values, then change events, then a heartbeat", async () => {
    const adapter = new ScriptedAdapter();
    const clock = new ManualClock();
    const loop = createReadLoop({
      adapter,
      registry,
      pollHz: 5,
      clock,
      log: silentLog,
      bind: sized,
    });
    cleanup.push(() => loop.close());
    await flush();
    adapter.memory.ewram[AT] = 2;
    const { url } = serveApp(loop, clock, loop as never);

    const response = await fetch(`${url}?topics=status,party`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("no body");
    cleanup.push(() => reader.cancel());

    const first = await readUntil(
      reader,
      (t) => t.includes("event: status") && t.includes("event: party"),
    );
    expect(first).toContain('event: party\ndata: {"pokemon":[{},{}]}');

    // The party changes, and the next poll pushes it.
    adapter.memory.ewram[AT] = 3;
    clock.advance(1000);
    const change = await readUntil(reader, (t) => t.includes("event: party"));
    expect(change).toContain('"pokemon":[{},{},{}]');

    clock.advance(HEARTBEAT_MS);
    const beat = await readUntil(reader, (t) => t.includes(": heartbeat"));
    expect(beat).toContain(": heartbeat");
  });

  test("a refused topic list answers 400 over the wire", async () => {
    const adapter = new ScriptedAdapter();
    const clock = new ManualClock();
    const loop = createReadLoop({
      adapter,
      registry,
      pollHz: 5,
      clock,
      log: silentLog,
      bind: sized,
    });
    cleanup.push(() => loop.close());
    const { url } = serveApp(loop, clock, loop as never);
    const response = await fetch(`${url}?topics=nope`);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "invalid_topics" },
    });
  });

  test("a socket nobody reads is unwritable, and its stream ends after 30 s", async () => {
    const listeners = new Set<(event: ChangeEvent) => void>();
    const released: Topic[][] = [];
    const source: StreamSource = {
      status: () => ({ state: "game", adapter: null, rom: null, game: null }) as never,
      get: async () => ({ ok: false, code: "no_data" }) as never,
      onChange: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      retain: (topics) => () => released.push([...topics]),
    };
    const clock = new ManualClock();
    const { server } = serveApp(source, clock, source as never);

    const socket: Socket = connect(server.port as number, "127.0.0.1");
    cleanup.push(() => {
      socket.destroy();
    });
    await new Promise<void>((resolve) => socket.once("connect", resolve));
    socket.write(
      "GET /api/v2/events?topics=bag HTTP/1.1\r\nHost: x\r\nAccept: text/event-stream\r\n\r\n",
    );
    // Reading starts paused: the kernel buffers fill, then the server's writes stall.
    socket.pause();

    const blob = "x".repeat(512 * 1024);
    for (let i = 0; i < 400 && released.length === 0; i++) {
      for (const listener of listeners)
        listener({ topic: "bag", value: { blob, i } } as ChangeEvent);
      await new Promise((r) => setTimeout(r, 2));
    }
    expect(released).toHaveLength(0);

    clock.advance(SLOW_CLIENT_MS - 1);
    expect(released).toHaveLength(0);
    clock.advance(1);
    expect(released).toEqual([["bag"]]);
  });
});
