import {
  INTERNAL_ERROR_STATUS,
  type InternalErrorBody,
  type InternalErrorCode,
} from "@pokemon-memory-reader/internal/errors";
import type { Context, MiddlewareHandler } from "hono";

/** Every route outside `/api/v2` belongs to one class (amendment 021, item 3). */
export type GuardClass = "open" | "write" | "debug" | "static";

/** Where the server listens, read per request because port 0 is only known once it is listening. */
export interface Listening {
  /** The configured bind host. */
  readonly host: string;
  readonly port: number;
}

/** An internal route's error answer: `{ error: { code, message } }` with the code's status. */
export function internalError(
  c: Context,
  code: InternalErrorCode,
  message: string,
): Response {
  const body: InternalErrorBody = { error: { code, message } };
  return c.json(body, INTERNAL_ERROR_STATUS[code]);
}

/**
 * The peer's address from the socket. Bun hands the server to `fetch` as the environment, and a
 * request that never came through a socket has none, which counts as not loopback.
 * `X-Forwarded-For` is never read.
 */
export function peerAddress(c: Context): string | null {
  const server = c.env as
    | { requestIP?: (request: Request) => { address: string } | null }
    | undefined;
  return server?.requestIP?.(c.req.raw)?.address ?? null;
}

export function isLoopbackPeer(address: string | null): boolean {
  if (address === null) return false;
  const bare = address.startsWith("::ffff:") ? address.slice(7) : address;
  return bare === "::1" || /^127(\.\d{1,3}){3}$/.test(bare);
}

const bracketed = (host: string) => (host.includes(":") ? `[${host}]` : host);

const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"] as const;

/** `Host` values, with the port, that name this server. HTTP leaves the port out of `Host` for port 80. */
function hostValues(names: readonly string[], port: number): Set<string> {
  const values = new Set<string>();
  for (const name of names) {
    values.add(`${name}:${port}`);
    if (port === 80) values.add(name);
  }
  return values;
}

type Check =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

function checkPeer(c: Context): Check {
  return isLoopbackPeer(peerAddress(c))
    ? { ok: true }
    : {
        ok: false,
        message: "This route only answers requests from this machine.",
      };
}

function checkHost(c: Context, allowed: Set<string>): Check {
  const host = c.req.header("Host");
  return host !== undefined && allowed.has(host.toLowerCase())
    ? { ok: true }
    : { ok: false, message: "The Host header doesn't name this server." };
}

/**
 * The write guard (spec §9.5, amendment 021 item 3): a loopback peer, `Content-Type:
 * application/json` (which forces a preflight no internal route approves), a `Host` on the
 * allowlist with the port, and any `Origin` equal to the server's own.
 */
export function writeGuard(listening: () => Listening): MiddlewareHandler {
  return async (c, next) => {
    const peer = checkPeer(c);
    if (!peer.ok) return internalError(c, "write_forbidden", peer.message);
    const { host, port } = listening();
    const allowed = hostValues([...LOOPBACK_HOSTS, bracketed(host)], port);
    const hostCheck = checkHost(c, allowed);
    if (!hostCheck.ok)
      return internalError(c, "write_forbidden", hostCheck.message);
    const origin = c.req.header("Origin");
    if (
      origin !== undefined &&
      origin !== `http://${c.req.header("Host")?.toLowerCase()}`
    )
      return internalError(
        c,
        "write_forbidden",
        "The Origin header isn't this server's own origin.",
      );
    const type = c.req
      .header("Content-Type")
      ?.split(";")[0]
      ?.trim()
      .toLowerCase();
    if (type !== "application/json")
      return internalError(
        c,
        "write_forbidden",
        "Writes must send Content-Type: application/json.",
      );
    return next();
  };
}

/**
 * The debug guard (amendment 021 item 3): a loopback peer, and a `Host` that is `localhost`,
 * `127.0.0.1` or `[::1]` with the port, never the configured bind host. A DNS-rebinding page on
 * the same machine passes the peer check, so the Host check is what stops it.
 */
export function debugGuard(listening: () => Listening): MiddlewareHandler {
  return async (c, next) => {
    const peer = checkPeer(c);
    if (!peer.ok) return internalError(c, "write_forbidden", peer.message);
    const hostCheck = checkHost(
      c,
      hostValues(LOOPBACK_HOSTS, listening().port),
    );
    if (!hostCheck.ok)
      return internalError(c, "write_forbidden", hostCheck.message);
    return next();
  };
}
