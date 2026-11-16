import { API_BASE_PATH } from "@pokemon-memory-reader/api/client";
import type { ErrorBody, Topic } from "@pokemon-memory-reader/api/schemas";
import { Hono } from "hono";
import type { Resources, UnavailableCode } from "../loop/read-loop";

/** Fixed English text per code. It carries no stability promise, so clients branch on `code` (amendment 020 §1). */
const MESSAGES: Readonly<Record<UnavailableCode, string>> = {
  disconnected: "No emulator adapter is connected.",
  no_game: "An emulator is connected but no game is loaded yet.",
  unidentified: "The loaded ROM matches no game profile.",
  unsupported: "This game's data format doesn't provide this resource yet.",
  no_data: "The game is loaded but this resource has no value yet.",
};

const SNAPSHOT_TOPICS: readonly Exclude<Topic, "status">[] = ["party"];

/**
 * The HTTP app (spec §7). Only the status and party snapshots are served. The SSE route, the
 * remaining resources, `/openapi.json`, the settings routes and the bridge downloads join it as
 * their tickets land.
 */
export function createApp(deps: { readonly resources: Resources }): Hono {
  const { resources } = deps;
  const app = new Hono();

  // Read-only, no auth, open to any origin, including hosted HTTPS overlays that reach localhost (spec §7.1).
  app.use("*", async (c, next) => {
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

  return app;
}
