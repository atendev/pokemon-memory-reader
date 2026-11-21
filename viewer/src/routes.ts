export const SCREENS = [
  { id: "party", label: "Party" },
  { id: "battle", label: "Battle" },
  { id: "boxes", label: "Boxes" },
  { id: "trainer", label: "Trainer & bag" },
  { id: "settings", label: "Settings" },
] as const;

export type ScreenId = (typeof SCREENS)[number]["id"];
export type Route = ScreenId | "about" | "not_found";

const SCREEN_IDS: readonly string[] = SCREENS.map((screen) => screen.id);

/** The hash route for a screen, such as `#/party` (amendment 021 item 2). */
export function hrefFor(route: ScreenId | "about"): string {
  return `#/${route}`;
}

/** The path of a hash, without `#`, the query and a trailing slash. `#/battle?showUnrevealed=1` is `/battle`. */
function hashPath(hash: string): string {
  const path =
    (hash.startsWith("#") ? hash.slice(1) : hash).split("?")[0] ?? "";
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/** An empty hash or `#/` opens Party. A path that names no screen is `not_found`. */
export function routeFromHash(hash: string): Route {
  const path = hashPath(hash);
  if (path === "" || path === "/") return "party";
  const id = path.startsWith("/") ? path.slice(1) : path;
  if (id === "about") return "about";
  return SCREEN_IDS.includes(id) ? (id as ScreenId) : "not_found";
}
