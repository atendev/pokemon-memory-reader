import type { ErrorBody, ResourceMap, StatusResource, Topic } from "./types.js";

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
}

export type PmrApiErrorKind =
  /** A 503 with the resource-unavailable body. `code`, `message` and `status` come from it. */
  | "unavailable"
  /** Any other non-2xx answer. */
  | "http"
  /** The request failed before an answer arrived. `cause` holds the fetch failure. */
  | "network";

/** Every failure a `get` helper throws (spec §10). Branch on `kind` and `code`, never on `message`. */
export class PmrApiError extends Error {
  readonly kind: PmrApiErrorKind;
  /** The HTTP status, or null for a network failure. */
  readonly httpStatus: number | null;
  /** The 503 body's `error.code`. Null for the other kinds. */
  readonly code: string | null;
  /** The `status` resource a 503 body carries. Null for the other kinds. */
  readonly status: StatusResource | null;

  constructor(
    kind: PmrApiErrorKind,
    message: string,
    details: {
      readonly httpStatus?: number | null;
      readonly code?: string | null;
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

/** Fetches one resource snapshot. Throws `PmrApiError`. The answer is not validated. */
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
    try {
      return (await response.json()) as ResourceMap[T];
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
