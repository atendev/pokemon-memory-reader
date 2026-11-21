import type { GuardClass } from "./guards";

export interface RouteEntry {
  readonly method: "GET" | "PUT" | "POST";
  readonly path: string;
  readonly guard: GuardClass;
}

/**
 * Every route outside `/api/v2` with its guard class (amendment 021, item 3). A route is
 * registered through `createApp`'s `internalRoute`, which looks it up here, so a route missing
 * from the table can't be registered, and the route-table test fails when a row here isn't
 * registered. A ticket that adds a route adds its row, one per line.
 * The viewer at `/` is served by `Bun.serve` itself and never reaches the app.
 */
export const ROUTES: readonly RouteEntry[] = [
  { method: "GET", path: "/settings", guard: "open" },
  { method: "PUT", path: "/settings", guard: "write" },
  { method: "GET", path: "/adapters", guard: "open" },
  { method: "POST", path: "/adapters/probe", guard: "write" },
  { method: "POST", path: "/adapters/switch", guard: "write" },
  { method: "GET", path: "/manual-picks", guard: "open" },
  { method: "POST", path: "/manual-picks", guard: "write" },
  { method: "POST", path: "/manual-picks/forget", guard: "write" },
  { method: "GET", path: "/about", guard: "open" },
  { method: "GET", path: "/about/third-party-notices.txt", guard: "open" },
  { method: "GET", path: "/update", guard: "open" },
  { method: "GET", path: "/debug/read", guard: "debug" },
  { method: "GET", path: "/bridges/:file", guard: "static" },
  { method: "GET", path: "/icons/*", guard: "static" },
];

export const guardOf = (method: string, path: string): GuardClass => {
  const found = ROUTES.find(
    (route) => route.method === method && route.path === path,
  );
  if (!found) throw new Error(`${method} ${path} is not in the route table`);
  return found.guard;
};
