import { describe, expect, test } from "bun:test";
import { ErrorBody, type Topic } from "@pokemon-memory-reader/api/schemas";
import { createApp } from "../../src/app/app";
import {
  createStreamHub,
  HEARTBEAT_MS,
  parseTopics,
  type Sink,
  SLOW_CLIENT_MS,
} from "../../src/app/stream";
import type {
  ChangeEvent,
  Resources,
  Snapshot,
  StreamSource,
} from "../../src/loop/read-loop";
import { ManualClock } from "../bridge/manual-clock";

const STATUS = {
  state: "game",
  adapter: null,
  rom: null,
  game: null,
} as never;

/** A source the test drives: `values` answers `get`, `emit` is a change event, and `retained` counts the demand. */
function fakeSource() {
  const listeners = new Set<(event: ChangeEvent) => void>();
  const values = new Map<Topic, unknown>();
  const retained: Topic[][] = [];
  const released: Topic[][] = [];
  const gets: Topic[] = [];
  const source: StreamSource = {
    status: () => STATUS,
    get: async (topic) => {
      gets.push(topic);
      return values.has(topic)
        ? ({ ok: true, value: values.get(topic) } as Snapshot<never>)
        : ({ ok: false, code: "no_data", status: STATUS } as Snapshot<never>);
    },
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    retain: (topics) => {
      retained.push([...topics]);
      return () => released.push([...topics]);
    },
  };
  const emit = (topic: Topic, value: unknown) => {
    for (const listener of listeners) listener({ topic, value } as ChangeEvent);
  };
  return { source, values, emit, retained, released, gets, listeners };
}

/** A sink with a queue of `room` writes before it is unwritable. */
function fakeSink(room = Number.POSITIVE_INFINITY) {
  const written: string[] = [];
  let free = room;
  const sink: Sink & { closed: boolean } = {
    closed: false,
    write: (text) => {
      written.push(text);
      free--;
    },
    writable: () => free > 0,
    close() {
      sink.closed = true;
    },
  };
  return {
    sink,
    written,
    /** The consumer took everything: `room` more writes fit. */
    drain: (more = room) => {
      free = more;
    },
  };
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

/** `[topic, parsed data]` of each event frame, ignoring comments. */
const events = (written: string[]) =>
  written.flatMap((text) => {
    const match = /^event: (\w+)\ndata: (.*)\n\n$/.exec(text);
    return match ? [[match[1], JSON.parse(match[2] ?? "null")]] : [];
  });

function setup(room?: number) {
  const clock = new ManualClock();
  const src = fakeSource();
  const hub = createStreamHub({ source: src.source, clock });
  const out = fakeSink(room);
  return { clock, src, hub, ...out };
}

describe("topics query", () => {
  test("known names are kept in the stream's order, duplicates and unknown names are ignored", () => {
    expect(parseTopics(["boxes,party, nonsense,party", "status"])).toEqual({
      ok: true,
      topics: ["status", "party", "boxes"],
    });
  });

  test.each([[[]], [[""]], [["nonsense"]], [[","]]])(
    "%j names no known topic",
    (values) => {
      const parsed = parseTopics(values);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.message).toContain("status, party");
    },
  );
});

describe("on-connect values and changes", () => {
  test("status goes first, a ready topic follows, and a topic without data is held until a change event", async () => {
    const { src, hub, sink, written } = setup();
    src.values.set("party", { pokemon: [] });
    hub.open(["status", "party", "bag"], sink);
    await flush();
    expect(events(written)).toEqual([
      ["status", STATUS],
      ["party", { pokemon: [] }],
    ]);
    expect(src.gets).toEqual(["party", "bag"]);

    src.emit("bag", { pockets: [] });
    src.emit("player", { name: "x" });
    expect(events(written).map(([topic]) => topic)).toEqual([
      "status",
      "party",
      "bag",
    ]);
  });

  test("a change event that landed before the on-connect value wins over it", async () => {
    const { src, hub, sink, written } = setup();
    src.values.set("party", "stale");
    hub.open(["party"], sink);
    src.emit("party", "fresh");
    await flush();
    expect(events(written)).toEqual([["party", "fresh"]]);
  });

  test("demand is registered for the requested topics and released when the client closes", async () => {
    const { src, hub, sink } = setup();
    const client = hub.open(["party", "boxes"], sink);
    expect(src.retained).toEqual([["party", "boxes"]]);
    expect(src.released).toEqual([]);
    client.close();
    client.close();
    expect(src.released).toEqual([["party", "boxes"]]);
    expect(sink.closed).toBe(true);
  });
});

describe("latest wins", () => {
  test("a newer event replaces the queued one and goes to the tail, for changes, on-connect values and status", async () => {
    const { src, hub, sink, written, drain } = setup(1);
    // The status on-connect value takes the only free slot, so the rest queue.
    hub.open(["status", "party", "player", "bag"], sink);
    await flush();
    expect(events(written)).toEqual([["status", STATUS]]);

    src.emit("party", 1);
    src.emit("player", 1);
    src.emit("party", 2);
    src.emit("bag", 1);
    src.emit("status", "newer status");
    src.emit("player", 2);
    expect(events(written)).toHaveLength(1);

    drain(10);
    // Any event wakes the flush, as a `pull` does.
    src.emit("bag", 2);
    expect(events(written).slice(1)).toEqual([
      ["party", 2],
      ["status", "newer status"],
      ["player", 2],
      ["bag", 2],
    ]);
  });

  test("an on-connect value waiting in the queue is replaced by a change", async () => {
    const { src, hub, sink, written, drain } = setup(0);
    src.values.set("party", "first");
    const client = hub.open(["party"], sink);
    await flush();
    src.emit("party", "second");
    drain(5);
    client.drain();
    expect(events(written)).toEqual([["party", "second"]]);
  });

  test("an event is serialized when it is written, so a replaced value is never sent", async () => {
    const { src, hub, sink, written, drain } = setup(0);
    const client = hub.open(["party"], sink);
    const first = { n: 1 };
    src.emit("party", first);
    first.n = 2;
    src.emit("party", { n: 3 });
    drain(5);
    client.drain();
    expect(events(written)).toEqual([["party", { n: 3 }]]);
  });
});

describe("slow clients", () => {
  test("a socket unwritable for 30 s is closed as a normal end of stream", async () => {
    const { src, hub, sink, clock } = setup(1);
    hub.open(["party"], sink);
    src.emit("party", 1);
    src.emit("party", 2);
    clock.advance(SLOW_CLIENT_MS - 1);
    expect(sink.closed).toBe(false);
    clock.advance(1);
    expect(sink.closed).toBe(true);
    expect(src.released).toEqual([["party"]]);
    // A closed client takes nothing more.
    src.emit("party", 3);
  });

  test("a socket that drains in time is kept, and the 30 s count starts over the next time it blocks", async () => {
    const { src, hub, sink, clock, drain } = setup(1);
    const client = hub.open(["party"], sink);
    src.emit("party", 1);
    clock.advance(SLOW_CLIENT_MS - 1000);
    drain(1);
    client.drain();
    clock.advance(5000);
    expect(sink.closed).toBe(false);

    src.emit("party", 2);
    clock.advance(SLOW_CLIENT_MS - 1);
    expect(sink.closed).toBe(false);
    clock.advance(1);
    expect(sink.closed).toBe(true);
  });

  test("the hub's close ends every stream and stops listening", async () => {
    const { src, hub, sink, written } = setup();
    hub.open(["party"], sink);
    hub.close();
    expect(sink.closed).toBe(true);
    expect(src.listeners.size).toBe(0);
    src.emit("party", 1);
    expect(events(written)).toEqual([]);
  });
});

describe("heartbeat", () => {
  test("a comment goes out every 15 s, and not once the stream is closed", async () => {
    const { hub, sink, written, clock } = setup();
    const client = hub.open(["party"], sink);
    clock.advance(HEARTBEAT_MS - 1);
    expect(written).toEqual([]);
    clock.advance(1);
    expect(written).toEqual([": heartbeat\n\n"]);
    clock.advance(HEARTBEAT_MS);
    expect(written).toHaveLength(2);
    client.close();
    clock.advance(HEARTBEAT_MS * 2);
    expect(written).toHaveLength(2);
  });

  test("an unwritable socket gets no heartbeat queued behind its events", async () => {
    const { hub, sink, written, clock } = setup(0);
    hub.open(["party"], sink);
    clock.advance(HEARTBEAT_MS);
    expect(written).toEqual([]);
  });
});

describe("GET /api/v2/events", () => {
  const resources: Resources = {
    status: () => STATUS,
    get: () => Promise.reject(new Error("unused")),
    box: () => Promise.reject(new Error("unused")),
  };
  const hub = createStreamHub({
    source: fakeSource().source,
    clock: new ManualClock(),
  });
  const app = createApp({ resources, stream: hub });

  test.each([
    "/api/v2/events",
    "/api/v2/events?topics=",
    "/api/v2/events?topics=nonsense",
  ])(
    "%s answers 400 invalid_topics with the status, before any stream opens",
    async (path) => {
      const response = await app.request(path);
      expect(response.status).toBe(400);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      const body = ErrorBody.parse(await response.json());
      expect(body.error.code).toBe("invalid_topics");
      expect(body.error.message).toContain("party");
      expect(body.status.state).toBe("game");
    },
  );

  test("a valid query opens an event stream", async () => {
    const response = await app.request("/api/v2/events?topics=status");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/event-stream; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toContain("no-cache");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    const reader = response.body?.getReader();
    const first = await reader?.read();
    expect(new TextDecoder().decode(first?.value)).toStartWith(
      "event: status\ndata: ",
    );
    await reader?.cancel();
  });

  test("without a hub the route is a 404", async () => {
    const bare = createApp({ resources });
    expect((await bare.request("/api/v2/events?topics=party")).status).toBe(
      404,
    );
  });
});
