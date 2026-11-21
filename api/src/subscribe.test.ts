import { describe, expect, test } from "bun:test";
import {
  type EventSourceLike,
  PmrApiError,
  subscribe,
  type TopicHandlers,
} from "./client";
import type { ConnectionState } from "./types";

type Listener = (event: { readonly data: unknown }) => void;

/** An `EventSource` the test drives by hand. */
class FakeSource implements EventSourceLike {
  static last: FakeSource;
  onopen: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  readyState = 0;
  closed = false;
  readonly listeners = new Map<string, Listener>();
  constructor(readonly url: string) {
    FakeSource.last = this;
  }
  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, listener);
  }
  close(): void {
    this.closed = true;
    this.readyState = 2;
  }
  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }
  send(topic: string, data: unknown): void {
    this.listeners.get(topic)?.({
      data: typeof data === "string" ? data : JSON.stringify(data),
    });
  }
  fail(readyState: number): void {
    this.readyState = readyState;
    this.onerror?.({});
  }
}

function setup(topics: string[], handlers: TopicHandlers = {}) {
  const states: ConnectionState[] = [];
  const errors: PmrApiError[] = [];
  const unknown: [string, unknown][] = [];
  const subscription = subscribe(topics, handlers, {
    baseUrl: "http://host:1",
    EventSource: FakeSource,
    onConnection: (state) => states.push(state),
    onError: (error) => errors.push(error),
    onUnknown: (topic, data) => unknown.push([topic, data]),
  });
  return { subscription, states, errors, unknown, source: FakeSource.last };
}

describe("subscribe", () => {
  test("asks for the topics, once each, and starts connecting", () => {
    const { subscription, source } = setup(["party", "status", "party"]);
    expect(source.url).toBe("http://host:1/api/v2/events?topics=party,status");
    expect(subscription.connection).toBe("connecting");
  });

  test("hands each known topic's parsed data to its handler", () => {
    const parties: unknown[] = [];
    const { source } = setup(["party", "status"], {
      party: (data) => parties.push(data),
    });
    source.send("party", { pokemon: [] });
    // `status` has no handler, so the event is dropped without a fault.
    source.send("status", { state: "game" });
    expect(parties).toEqual([{ pokemon: [] }]);
  });

  test("a requested topic the package doesn't know goes to onUnknown, unvalidated", () => {
    const { source, unknown } = setup(["party", "future-topic"]);
    source.send("future-topic", { anything: 1 });
    expect(unknown).toEqual([["future-topic", { anything: 1 }]]);
  });

  test("connection follows open, a dropped link and the reconnect", () => {
    const { subscription, states, source } = setup(["status"]);
    source.open();
    expect(subscription.connection).toBe("open");
    source.fail(0);
    expect(subscription.connection).toBe("reconnecting");
    source.open();
    expect(states).toEqual(["open", "reconnecting", "open"]);
  });

  test("a refused connection closes without a retry and reports an http error", () => {
    const { subscription, states, errors, source } = setup(["nope"]);
    source.fail(2);
    expect(subscription.connection).toBe("closed");
    expect(states).toEqual(["closed"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(PmrApiError);
    expect(errors[0]?.kind).toBe("http");
  });

  test("a body that isn't JSON is reported and the stream goes on", () => {
    const parties: unknown[] = [];
    const { errors, source, subscription } = setup(["party"], {
      party: (data) => parties.push(data),
    });
    source.open();
    source.send("party", "{broken");
    expect(errors.map((error) => error.kind)).toEqual(["http"]);
    expect(subscription.connection).toBe("open");
    source.send("party", { pokemon: [] });
    expect(parties).toHaveLength(1);
  });

  test("close ends the source and silences the handlers", () => {
    const parties: unknown[] = [];
    const { subscription, states, source } = setup(["party"], {
      party: (data) => parties.push(data),
    });
    source.open();
    subscription.close();
    subscription.close();
    expect(source.closed).toBe(true);
    expect(subscription.connection).toBe("closed");
    expect(states).toEqual(["open", "closed"]);
    source.send("party", { pokemon: [] });
    source.open();
    expect(parties).toHaveLength(0);
    expect(subscription.connection).toBe("closed");
  });

  test("without an EventSource it throws a PmrApiError", () => {
    const original = globalThis.EventSource;
    // biome-ignore lint/suspicious/noExplicitAny: removes the global for this test.
    (globalThis as any).EventSource = undefined;
    try {
      expect(() => subscribe(["status"], {})).toThrow(PmrApiError);
    } finally {
      // biome-ignore lint/suspicious/noExplicitAny: puts it back.
      (globalThis as any).EventSource = original;
    }
  });
});
