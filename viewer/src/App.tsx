import type {
  Battle,
  StatusResource,
} from "@pokemon-memory-reader/api/schemas";
import { About } from "./About";
import { BattleScreen } from "./BattleScreen";
import { ConnectionScreen } from "./ConnectionScreen";
import { useSidebarCollapsed } from "./collapse";
import { PartyScreen } from "./PartyScreen";
import { Placeholder } from "./Placeholder";
import { type Route, routeFromHash, SCREENS } from "./routes";
import { Sidebar } from "./Sidebar";
import {
  type Loaded,
  useBattle,
  useHash,
  useParty,
  useStatus,
} from "./useResource";

const LOADING = { kind: "loading" } as const;
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
  battle = LOADING,
}: {
  route: Route;
  status: StatusResource | null;
  party: ReturnType<typeof useParty>;
  battle?: Loaded<Battle>;
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
  if (route === "battle") return <BattleScreen battle={battle} />;
  const screen = SCREENS.find((s) => s.id === route);
  return <Placeholder title={screen?.label ?? "Page not found"} />;
}

export function App() {
  const route = routeFromHash(useHash());
  const status = useStatus();
  const known = status.kind === "ready" ? status.value : null;
  const inGame = known?.state === "game";
  const party = useParty(inGame && route === "party");
  const battle = useBattle(inGame);
  const battleLive = battle.kind === "ready" && battle.value.active;
  const [collapsed, toggle] = useSidebarCollapsed();
  return (
    <div className={collapsed ? "shell shell-collapsed" : "shell"}>
      <Sidebar
        route={route}
        collapsed={collapsed}
        onToggle={toggle}
        status={known}
        battleLive={battleLive}
      />
      <main className="content">
        {status.kind === "loading" ? null : (
          <Screen route={route} status={known} party={party} battle={battle} />
        )}
      </main>
    </div>
  );
}
