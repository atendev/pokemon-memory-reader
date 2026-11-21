import type {
  Bag,
  Battle,
  Boxes,
  Player,
  StatusResource,
} from "@pokemon-memory-reader/api/schemas";
import type { AboutBody } from "@pokemon-memory-reader/internal/about";
import type { AdaptersBody } from "@pokemon-memory-reader/internal/adapters-route";
import type { SettingsBody } from "@pokemon-memory-reader/internal/settings-route";
import type { UpdateBody } from "@pokemon-memory-reader/internal/update";
import { useMemo } from "react";
import { About } from "./About";
import { IconsProvider } from "./Art";
import { BattleScreen } from "./BattleScreen";
import { BoxesScreen } from "./BoxesScreen";
import { ConnectionScreen } from "./ConnectionScreen";
import { useSidebarCollapsed } from "./collapse";
import { IconFailures } from "./icons";
import { PartyScreen } from "./PartyScreen";
import { Placeholder } from "./Placeholder";
import { type Route, routeFromHash, SCREENS } from "./routes";
import { SettingsScreen } from "./SettingsScreen";
import { Sidebar } from "./Sidebar";
import { TrainerScreen } from "./TrainerScreen";
import { UpdateBanner } from "./UpdateBanner";
import {
  type Polled,
  useAbout,
  useAdapters,
  useSettings,
  useUpdate,
} from "./useInternal";
import {
  type Loaded,
  useBag,
  useBattle,
  useBoxes,
  useHash,
  useIconMode,
  useParty,
  usePlayer,
  useStatus,
} from "./useResource";

/** One for the page: a failed icon URL stays failed until the key changes or the page reloads. */
const iconFailures = new IconFailures();

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
  boxes = LOADING,
  player = LOADING,
  bag = LOADING,
  about = LOADING,
  update = LOADING,
  settings = LOADING,
  adapters = LOADING,
}: {
  route: Route;
  status: StatusResource | null;
  party: ReturnType<typeof useParty>;
  battle?: Loaded<Battle>;
  boxes?: Loaded<Boxes>;
  player?: Loaded<Player>;
  bag?: Loaded<Bag>;
  about?: Polled<AboutBody>;
  update?: Polled<UpdateBody>;
  settings?: Polled<SettingsBody>;
  adapters?: Polled<AdaptersBody>;
}) {
  const connection = { settings, adapters, about };
  if (route === "about") return <About about={about} update={update} />;
  if (route === "settings") return <SettingsScreen status={status} />;
  if (route === "not_found") return <Placeholder title="Page not found" />;
  if (GAME_SCREENS.includes(route) && status?.state !== "game") {
    return <ConnectionScreen status={status} {...connection} />;
  }
  if (route === "party") {
    if (party.kind === "unavailable" && party.code === "unsupported") {
      return <ConnectionScreen status={status} unsupported {...connection} />;
    }
    return <PartyScreen party={party} />;
  }
  if (route === "battle") return <BattleScreen battle={battle} />;
  if (route === "boxes") {
    return <BoxesScreen boxes={boxes} generation={status?.game?.generation} />;
  }
  if (route === "trainer") return <TrainerScreen player={player} bag={bag} />;
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
  const boxes = useBoxes(inGame && route === "boxes");
  const player = usePlayer(inGame && route === "trainer");
  const bag = useBag(inGame && route === "trainer");
  const battleLive = battle.kind === "ready" && battle.value.active;
  const iconMode = useIconMode(inGame);
  const iconSettings = useMemo(
    () => ({
      profileId: inGame ? (known?.game?.profileId ?? null) : null,
      generation: known?.game?.generation ?? null,
      mode: iconMode,
    }),
    [inGame, known?.game?.profileId, known?.game?.generation, iconMode],
  );
  const connecting =
    GAME_SCREENS.includes(route) &&
    (!inGame || (party.kind === "unavailable" && party.code === "unsupported"));
  const about = useAbout(route === "about" || connecting);
  const settings = useSettings(connecting);
  const adapters = useAdapters(connecting);
  const update = useUpdate();
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
        <UpdateBanner update={update} />
        {status.kind === "loading" ? null : (
          <IconsProvider settings={iconSettings} failures={iconFailures}>
            <Screen
              route={route}
              status={known}
              party={party}
              battle={battle}
              boxes={boxes}
              player={player}
              bag={bag}
              about={about.state}
              settings={settings.state}
              adapters={adapters.state}
              update={update}
            />
          </IconsProvider>
        )}
      </main>
    </div>
  );
}
