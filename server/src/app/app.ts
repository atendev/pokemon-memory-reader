import { API_BASE_PATH } from "@pokemon-memory-reader/api/client";
import type { ErrorBody, Topic } from "@pokemon-memory-reader/api/schemas";
import type { AboutBody } from "@pokemon-memory-reader/internal/about";
import { type Handler, Hono } from "hono";
import type { Config } from "../config";
import { checkPatch, saveSettings } from "../config-save";
import { type Log, silentLog } from "../log";
import type {
  RawReadResult,
  Resources,
  UnavailableCode,
} from "../loop/read-loop";
import { settingsBody } from "../settings-body";
import {
  debugGuard,
  internalError,
  isLoopbackPeer,
  type Listening,
  peerAddress,
  writeGuard,
} from "./guards";
import { guardOf } from "./route-table";

/** Fixed English text per code. It carries no stability promise, so clients branch on `code` (amendment 020 §1). */
const MESSAGES: Readonly<Record<UnavailableCode, string>> = {
  disconnected: "No emulator adapter is connected.",
  no_game: "An emulator is connected but no game is loaded yet.",
  unidentified: "The loaded ROM matches no game profile.",
  unsupported: "This game's data format doesn't provide this resource yet.",
  no_data: "The game is loaded but this resource has no value yet.",
};

const SNAPSHOT_TOPICS: readonly Exclude<Topic, "status">[] = [
  "party",
  "player",
  "bag",
  "battle",
  "boxes",
];

/** What `GET /about` and the notices route serve. */
export interface AboutInfo extends Omit<AboutBody, "notices"> {
  /** The generated notices text, or null in a dev build without it. */
  readonly notices: string | null;
}

/**
 * The HTTP app (spec §7). Only the status, party, battle and boxes snapshots, the bridge
 * downloads and the internal routes below `/api/v2` are served. The SSE route, the remaining
 * resources and `/openapi.json` join it as their tickets land. The viewer is served by `Bun.serve`
 * itself (see `startServer`).
 *
 * The routes outside `/api/v2` register through `internalRoute`, which takes the guard class from
 * the route table. A group registers only when its dependency is given: `/settings` with
 * `config`, `/about` with `about`, and `/debug/read` with `rawRead`, which only `--debug` passes.
 */
export function createApp(deps: {
  readonly resources: Resources;
  /** Bridge source by name, served at `/bridges/<name>.lua` (spec §4.11). Absent means no bridge routes. */
  readonly bridges?: Readonly<Record<string, string>>;
  readonly log?: Log;
  readonly config?: Config;
  readonly about?: AboutInfo;
  readonly rawRead?: (
    address: string,
    length: number,
  ) => Promise<RawReadResult>;
  /** Where the server listens, for the Host checks. Defaults to the loopback host on port 7425. */
  readonly listening?: () => Listening;
}): Hono {
  const { resources } = deps;
  const log = deps.log ?? silentLog;
  const listening =
    deps.listening ?? (() => ({ host: "127.0.0.1", port: 7425 }));
  const app = new Hono();

  // Read-only, no auth, open to any origin, including hosted HTTPS overlays that reach localhost (spec §7.1).
  // Only `/api/v2` is cross-origin: no internal route sends this header or approves a preflight (amendment 021, item 3).
  app.use(`${API_BASE_PATH}/*`, async (c, next) => {
    c.header("Access-Control-Allow-Origin", "*");
    if (c.req.method !== "OPTIONS") return next();
    c.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    c.header(
      "Access-Control-Allow-Headers",
      c.req.header("Access-Control-Request-Headers") ?? "*",
    );
    if (c.req.header("Access-Control-Request-Private-Network") === "true")
      c.header("Access-Control-Allow-Private-Network", "true");
    return c.body(null, 204);
  });

  const failure = (code: string, message: string): ErrorBody => ({
    error: { code, message },
    status: resources.status(),
  });

  app.get(`${API_BASE_PATH}/status`, (c) => c.json(resources.status()));

  for (const topic of SNAPSHOT_TOPICS) {
    app.get(`${API_BASE_PATH}/${topic}`, async (c) => {
      const snapshot = await resources.get(topic);
      if (snapshot.ok) return c.json(snapshot.value);
      const body: ErrorBody = {
        error: { code: snapshot.code, message: MESSAGES[snapshot.code] },
        status: snapshot.status,
      };
      return c.json(body, 503);
    });
  }

  app.get(`${API_BASE_PATH}/boxes/:n`, async (c) => {
    const snapshot = await resources.box(c.req.param("n"));
    if (snapshot.ok) return c.json(snapshot.value);
    if (snapshot.code === "not_found")
      return c.json(failure("not_found", "No such box."), 404);
    const body: ErrorBody = {
      error: { code: snapshot.code, message: MESSAGES[snapshot.code] },
      status: snapshot.status,
    };
    return c.json(body, 503);
  });

  /** Registers a route outside `/api/v2` under the guard class the route table gives it. */
  const internalRoute = (
    method: "GET" | "PUT" | "POST",
    path: string,
    handler: Handler,
  ): void => {
    const guard = guardOf(method, path);
    const guards =
      guard === "write"
        ? [writeGuard(listening)]
        : guard === "debug"
          ? [debugGuard(listening)]
          : [];
    app.on(method, path, ...([...guards, handler] as [Handler]));
  };

  const { config } = deps;
  if (config) {
    internalRoute("GET", "/settings", async (c) =>
      c.json(
        await settingsBody(config, {
          loopback: isLoopbackPeer(peerAddress(c)),
        }),
      ),
    );
    internalRoute("PUT", "/settings", async (c) => {
      const raw: unknown = await c.req.json().catch(() => undefined);
      const patch = checkPatch(raw);
      if (!patch.ok) return internalError(c, "invalid_setting", patch.message);
      const saved = await saveSettings(config, patch.patch);
      if (!saved.ok) return internalError(c, saved.code, saved.message);
      // A write guard passed, so the peer is loopback and may see the paths.
      return c.json(await settingsBody(config, { loopback: true }));
    });
  }

  const { about } = deps;
  if (about) {
    const { notices, ...info } = about;
    internalRoute("GET", "/about", (c) =>
      c.json({ ...info, notices: notices !== null } satisfies AboutBody),
    );
    internalRoute("GET", "/about/third-party-notices.txt", (c) =>
      notices === null
        ? c.text("Third-party notices ship with release builds.", 404)
        : c.body(notices, 200, {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Content-Type-Options": "nosniff",
          }),
    );
  }

  const { rawRead } = deps;
  if (rawRead) {
    internalRoute("GET", "/debug/read", async (c) => {
      const address = c.req.query("address");
      const length = c.req.query("length");
      if (address === undefined || address === "")
        return internalError(c, "invalid_request", "address is required.");
      if (length === undefined || !/^-?\d+$/.test(length))
        return internalError(
          c,
          "invalid_request",
          "length must be an integer.",
        );
      const result = await rawRead(address, Number(length));
      return result.ok
        ? c.json(result.value)
        : internalError(c, result.code, result.message);
    });
  }

  // Looked up in the map and never joined to a path, so no request reaches the filesystem (spec §4.11).
  const bridges = new Map(Object.entries(deps.bridges ?? {}));
  internalRoute("GET", "/bridges/:file", (c) => {
    const file = c.req.param("file") ?? "";
    const source = file.endsWith(".lua")
      ? bridges.get(file.slice(0, -4))
      : undefined;
    if (source === undefined) return c.notFound();
    return c.body(source, 200, { "Content-Type": "text/plain; charset=utf-8" });
  });

  app.notFound((c) => c.json(failure("not_found", "No such resource."), 404));
  app.onError((error, c) => {
    log.error("request failed", { error });
    return c.json(failure("internal", "The server failed to answer."), 500);
  });

  return app;
}
