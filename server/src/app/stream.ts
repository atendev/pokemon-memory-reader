import type { Topic } from "@pokemon-memory-reader/api/schemas";
import type { Clock } from "../clock";
import { type Log, silentLog } from "../log";
import type { StreamSource } from "../loop/read-loop";

/** A comment goes out this often, so a proxy or an idle timeout doesn't drop a quiet stream (spec §8.8). */
export const HEARTBEAT_MS = 15_000;
/** A socket that stays unwritable this long ends its stream. `EventSource` reconnects (spec §8.8). */
export const SLOW_CLIENT_MS = 30_000;

/** Every topic the stream knows. The record fails typecheck when the API package gains a topic this file lacks (spec §10). */
const KNOWN: Record<Topic, true> = {
  status: true,
  party: true,
  player: true,
  bag: true,
  battle: true,
  boxes: true,
};
export const KNOWN_TOPICS = Object.keys(KNOWN) as readonly Topic[];

export type TopicsParse =
  | { readonly ok: true; readonly topics: readonly Topic[] }
  | { readonly ok: false; readonly message: string };

/**
 * The `topics` query values: comma-separated names, repeated parameters joined. Unknown names are
 * ignored, and a query naming no known topic is refused (spec §7.2, amendment 020 §4).
 */
export function parseTopics(values: readonly string[]): TopicsParse {
  const named = new Set(
    values.flatMap((value) => value.split(",").map((name) => name.trim())),
  );
  const topics = KNOWN_TOPICS.filter((topic) => named.has(topic));
  return topics.length > 0
    ? { ok: true, topics }
    : {
        ok: false,
        message: `topics must name at least one of: ${KNOWN_TOPICS.join(", ")}.`,
      };
}

/** Where one client's text goes. The route backs it with a response stream. */
export interface Sink {
  write(text: string): void;
  /** False while the socket has taken less than was written to it. */
  writable(): boolean;
  /** Ends the stream normally. */
  close(): void;
}

export interface StreamClient {
  /** The sink can take more again: send what is queued. */
  drain(): void;
  close(): void;
}

export interface StreamHub {
  /** Starts one client on these topics and sends its on-connect values as they become available. */
  open(topics: readonly Topic[], sink: Sink): StreamClient;
  /** Ends every stream, for shutdown. */
  close(): void;
}

const frame = (topic: Topic, value: unknown): string =>
  `event: ${topic}\ndata: ${JSON.stringify(value)}\n\n`;

export function createStreamHub(deps: {
  readonly source: StreamSource;
  readonly clock: Clock;
  readonly log?: Log;
}): StreamHub {
  const { source, clock } = deps;
  const log = deps.log ?? silentLog;
  const clients = new Set<{
    readonly topics: ReadonlySet<Topic>;
    push(topic: Topic, value: unknown): void;
    close(): void;
  }>();

  const stopListening = source.onChange((event) => {
    for (const client of clients)
      if (client.topics.has(event.topic)) client.push(event.topic, event.value);
  });

  return {
    open(requested, sink) {
      const topics = new Set(requested);
      // Each topic holds its latest event only. A newer one replaces it and goes to the tail (spec §8.8).
      const pending = new Map<Topic, unknown>();
      /** Topics that have had an event, so a late on-connect value never replaces a newer change. */
      const seen = new Set<Topic>();
      let closed = false;
      let cancelSlow: (() => void) | null = null;
      let cancelBeat: (() => void) | null = null;

      const stopSlow = () => {
        cancelSlow?.();
        cancelSlow = null;
      };
      const flush = (): void => {
        while (!closed && pending.size > 0 && sink.writable()) {
          const [topic, value] = pending.entries().next().value as [
            Topic,
            unknown,
          ];
          pending.delete(topic);
          sink.write(frame(topic, value));
        }
        if (closed) return;
        if (sink.writable()) stopSlow();
        else cancelSlow ??= clock.setTimeout(close, SLOW_CLIENT_MS);
      };
      const push = (topic: Topic, value: unknown): void => {
        if (closed) return;
        seen.add(topic);
        pending.delete(topic);
        pending.set(topic, value);
        flush();
      };

      const release = source.retain(requested);
      function close(): void {
        if (closed) return;
        closed = true;
        clients.delete(entry);
        release();
        stopSlow();
        cancelBeat?.();
        pending.clear();
        try {
          sink.close();
        } catch (error) {
          log.debug("closing a stream failed", { error });
        }
      }
      const beat = (): void => {
        if (closed) return;
        if (sink.writable()) sink.write(": heartbeat\n\n");
        cancelBeat = clock.setTimeout(beat, HEARTBEAT_MS);
      };
      const entry = { topics, push, close };
      clients.add(entry);
      cancelBeat = clock.setTimeout(beat, HEARTBEAT_MS);

      // `status` is always read, so its on-connect value is the current one.
      if (topics.has("status")) push("status", source.status());
      for (const topic of requested) {
        if (topic === "status") continue;
        // A topic that can't answer yet is held: its first decoded value arrives as a change event (spec §7.3).
        source
          .get(topic)
          .then((snapshot) => {
            if (snapshot.ok && !closed && !seen.has(topic))
              push(topic, snapshot.value);
          })
          .catch((error) => log.error("on-connect read failed", { error }));
      }
      return { drain: flush, close };
    },
    close() {
      stopListening();
      for (const client of [...clients]) client.close();
    },
  };
}
