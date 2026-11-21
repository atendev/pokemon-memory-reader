import type { StatusResource } from "@pokemon-memory-reader/api/schemas";
import { About } from "./About";
import { ConnectionScreen } from "./ConnectionScreen";
import { useSidebarCollapsed } from "./collapse";
import { PartyScreen } from "./PartyScreen";
import { Placeholder } from "./Placeholder";
import { type Route, routeFromHash, SCREENS } from "./routes";
import { Sidebar } from "./Sidebar";
import { useHash, useParty, useStatus } from "./useResource";

const GAME_SCREENS: readonly Route[] = ["party", "battle", "boxes", "trainer"];

/**
 * The screen for a route. About and Settings need no game, so they show whatever the state. The
 * game screens give way to the connection screen until a game is identified, and Party gives way
 * to it again when its resource answers 503 `unsupported`.
 */
export function Screen({
  route,
  status,
  party,
}: {
  route: Route;
  status: StatusResource | null;
  party: ReturnType<typeof useParty>;
}) {
  if (route === "about") return <About />;
  if (route === "not_found") return <Placeholder title="Page not found" />;
  if (GAME_SCREENS.includes(route) && status?.state !== "game") {
    return <ConnectionScreen status={status} />;
  }
  if (route === "party") {
    if (party.kind === "unavailable" && party.code === "unsupported") {
      return <ConnectionScreen status={status} unsupported />;
    }
    return <PartyScreen party={party} />;
  }
  const screen = SCREENS.find((s) => s.id === route);
  return <Placeholder title={screen?.label ?? "Page not found"} />;
}

export function App() {
  const route = routeFromHash(useHash());
  const status = useStatus();
  const known = status.kind === "ready" ? status.value : null;
  const party = useParty(known?.state === "game" && route === "party");
  const [collapsed, toggle] = useSidebarCollapsed();
  return (
    <div className={collapsed ? "shell shell-collapsed" : "shell"}>
      <Sidebar
        route={route}
        collapsed={collapsed}
        onToggle={toggle}
        status={known}
      />
      <main className="content">
        {status.kind === "loading" ? null : (
          <Screen route={route} status={known} party={party} />
        )}
      </main>
    </div>
  );
}
