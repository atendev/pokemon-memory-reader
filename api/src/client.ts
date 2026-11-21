import { TOPIC_NAMES } from "./meanings.js";
import type {
  ConnectionState,
  ErrorBody,
  ErrorCode,
  ResourceMap,
  StatusResource,
  Topic,
} from "./types.js";

export const API_VERSION = 2;
export const API_BASE_PATH = `/api/v${API_VERSION}`;
/** Fixed within 2.x. The host is an IP literal because `localhost` can resolve to `::1` first. */
export const DEFAULT_PORT = 7425;
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_BASE_URL = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;

export interface ClientOptions {
  /** Defaults to `DEFAULT_BASE_URL`. A page served by the program passes its own origin. */
  readonly baseUrl?: string;
  /** Defaults to the global `fetch`. */
  readonly fetch?: typeof fetch;
  /**
   * Checks each answer or event against the `/schemas` Zod schema for its topic. A bad one is
   * reported as a `PmrApiError` of kind `invalid`. Off by default. `/schemas` loads by dynamic
   * import only when this is set, so a client that never sets it needs no `zod`.
   */
  readonly validate?: boolean;
}

export type PmrApiErrorKind =
  /** A 503 with the resource-unavailable body. `code`, `message` and `status` come from it. */
  | "unavailable"
  /** Any other non-2xx answer. */
  | "http"
  /** `validate` is set and the data failed its schema, or `/schemas` could not load. `cause` holds the Zod error or the load failure. */
  | "invalid"
  /** The request failed before an answer arrived. `cause` holds the fetch failure. */
  | "network";

/** Every failure a `get` helper throws (spec §10). Branch on `kind` and `code`, never on `message`. */
export class PmrApiError extends Error {
  readonly kind: PmrApiErrorKind;
  /** The HTTP status, or null for a network failure. */
  readonly httpStatus: number | null;
  /** The 503 body's `error.code`. Null for the other kinds. */
  readonly code: ErrorCode | null;
  /** The `status` resource a 503 body carries. Null for the other kinds. */
  readonly status: StatusResource | null;

  constructor(
    kind: PmrApiErrorKind,
    message: string,
    details: {
      readonly httpStatus?: number | null;
      readonly code?: ErrorCode | null;
      readonly status?: StatusResource | null;
      readonly cause?: unknown;
    } = {},
  ) {
    super(message, { cause: details.cause });
    this.name = "PmrApiError";
    this.kind = kind;
    this.httpStatus = details.httpStatus ?? null;
    this.code = details.code ?? null;
    this.status = details.status ?? null;
  }
}

function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== "object" || value === null) return false;
  const { error, status } = value as Record<string, unknown>;
  if (typeof error !== "object" || error === null) return false;
  const { code, message } = error as Record<string, unknown>;
  return (
    typeof code === "string" &&
    typeof message === "string" &&
    typeof status === "object" &&
    status !== null
  );
}

/** The one place `/client` reaches `/schemas`. The import test allows this call and no other. */
const loadSchemas = () => import("./schemas.js");

/** Throws a `PmrApiError` of kind `invalid` when `data` fails the schema for `topic`. */
async function validateResource(
  topic: Topic,
  data: unknown,
  httpStatus: number | null,
): Promise<void> {
  let schemas: Awaited<ReturnType<typeof loadSchemas>>;
  try {
    schemas = await loadSchemas();
  } catch (cause) {
    throw new PmrApiError(
      "invalid",
      "validate needs /schemas and its zod peer dependency, which could not be loaded",
      { httpStatus, cause },
    );
  }
  const result = schemas.resourceSchemas[topic].safeParse(data);
  if (result.success) return;
  const issue = result.error.issues[0];
  const where = issue?.path.length ? ` at ${issue.path.join(".")}` : "";
  throw new PmrApiError(
    "invalid",
    `the ${topic} data failed validation${where}: ${issue?.message ?? "unknown issue"}`,
    { httpStatus, cause: result.error },
  );
}

/** Fetches one resource snapshot. Throws `PmrApiError`. The answer is validated only when `options.validate` is set. */
export async function get<T extends Topic>(
  topic: T,
  options: ClientOptions = {},
): Promise<ResourceMap[T]> {
  const doFetch = options.fetch ?? fetch;
  const url = `${options.baseUrl ?? DEFAULT_BASE_URL}${API_BASE_PATH}/${topic}`;
  let response: Response;
  try {
    response = await doFetch(url);
  } catch (cause) {
    throw new PmrApiError("network", `could not reach ${url}`, { cause });
  }
  if (response.ok) {
    let data: unknown;
    try {
      data = await response.json();
    } catch (cause) {
      throw new PmrApiError(
        "http",
        `${url} answered with a body that is not JSON`,
        {
          httpStatus: response.status,
          cause,
        },
      );
    }
    if (options.validate) await validateResource(topic, data, response.status);
    return data as ResourceMap[T];
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.status === 503 && isErrorBody(body)) {
    throw new PmrApiError("unavailable", body.error.message, {
      httpStatus: 503,
      code: body.error.code,
      status: body.status,
    });
  }
  throw new PmrApiError("http", `${url} answered ${response.status}`, {
    httpStatus: response.status,
  });
}

export const getStatus = (options?: ClientOptions) => get("status", options);
export const getParty = (options?: ClientOptions) => get("party", options);

/** The part of the browser `EventSource` that `subscribe` uses, so a Node polyfill or a test double fits. */
export interface EventSourceLike {
  onopen: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  /** 0 connecting, 1 open, 2 closed. */
  readonly readyState: number;
  addEventListener(
    type: string,
    listener: (event: { readonly data: unknown }) => void,
  ): void;
  close(): void;
}

export interface SubscribeOptions extends ClientOptions {
  /** Defaults to the global `EventSource`. */
  readonly EventSource?: new (
    url: string,
  ) => EventSourceLike;
  /** Called on every change of `connection`. */
  readonly onConnection?: (state: ConnectionState) => void;
  /**
   * Called with a `PmrApiError` for a refused connection, an event body that isn't JSON, or with
   * `validate` set, an event of kind `invalid`. An invalid event is dropped, never handed to a handler.
   */
  readonly onError?: (error: PmrApiError) => void;
  /** Called for a requested topic this package doesn't know. `data` is the parsed body, never validated. */
  readonly onUnknown?: (topic: string, data: unknown) => void;
}

/** One handler per known topic, each given the resource a `GET` of it returns. */
export type TopicHandlers = {
  readonly [T in Topic]?: (data: ResourceMap[T]) => void;
};

export interface Subscription {
  readonly connection: ConnectionState;
  /** Ends the stream. No handler runs after it. */
  close(): void;
}

const CLOSED = 2;
const isKnownTopic = (topic: string): topic is Topic =>
  Object.hasOwn(TOPIC_NAMES, topic);

/**
 * Opens `/events` for these topics. The server sends each topic's current value on connect, which
 * also covers the reconnects `EventSource` makes by itself. A refused connection, such as a `400` for
 * a `topics` list naming nothing the server knows, closes it and reports a `PmrApiError` of kind
 * `http` through `onError` with no retry. The data is validated only when `options.validate` is set,
 * and events then reach their handlers in arrival order.
 */
export function subscribe(
  topics: readonly (Topic | (string & {}))[],
  handlers: TopicHandlers,
  options: SubscribeOptions = {},
): Subscription {
  const Source =
    options.EventSource ??
    (globalThis.EventSource as unknown as
      | (new (
          url: string,
        ) => EventSourceLike)
      | undefined);
  if (!Source)
    throw new PmrApiError("network", "no EventSource is available", {});
  const names = [...new Set(topics)];
  const url = `${options.baseUrl ?? DEFAULT_BASE_URL}${API_BASE_PATH}/events?topics=${names
    .map(encodeURIComponent)
    .join(",")}`;
  let connection: ConnectionState = "connecting";
  const setConnection = (next: ConnectionState): void => {
    if (connection === next) return;
    connection = next;
    options.onConnection?.(next);
  };

  let queue: Promise<void> = Promise.resolve();
  const source = new Source(url);
  const handle = (topic: string, raw: unknown): void => {
    if (connection === "closed") return;
    let data: unknown;
    try {
      data = JSON.parse(String(raw));
    } catch (cause) {
      options.onError?.(
        new PmrApiError(
          "http",
          `a ${topic} event carried a body that is not JSON`,
          {
            cause,
          },
        ),
      );
      return;
    }
    if (!isKnownTopic(topic)) {
      options.onUnknown?.(topic, data);
      return;
    }
    const deliver = (): void =>
      (handlers[topic] as ((value: unknown) => void) | undefined)?.(data);
    if (!options.validate) {
      deliver();
      return;
    }
    // Validation waits on a dynamic import, so a queue keeps events in arrival order.
    queue = queue
      .then(() => validateResource(topic, data, null))
      .then(
        () => {
          if (connection !== "closed") deliver();
        },
        (error: PmrApiError) => {
          if (connection !== "closed") options.onError?.(error);
        },
      );
  };
  for (const topic of names)
    source.addEventListener(topic, (event) => handle(topic, event.data));
  source.onopen = () => {
    if (connection !== "closed") setConnection("open");
  };
  source.onerror = () => {
    if (connection === "closed") return;
    if (source.readyState === CLOSED) {
      // The browser gives up on a non-200 answer, such as the 400 for a bad `topics` list.
      setConnection("closed");
      options.onError?.(
        new PmrApiError("http", `${url} refused the stream`, {}),
      );
    } else setConnection("reconnecting");
  };

  return {
    get connection() {
      return connection;
    },
    close() {
      if (connection === "closed") return;
      source.close();
      setConnection("closed");
    },
  };
}
