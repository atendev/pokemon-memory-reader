import type { StatusResource } from "@pokemon-memory-reader/api/schemas";
import { connectionLabel } from "./display";
import { Icon } from "./Icon";
import { hrefFor, type Route, SCREENS, type ScreenId } from "./routes";

export function StatusBlock({ status }: { status: StatusResource | null }) {
  const adapter =
    status?.adapter?.bridge?.emulator?.name ?? status?.adapter?.id;
  const label = connectionLabel(status);
  return (
    <div className="status" role="status" aria-label={label}>
      <span
        className={`dot dot-${status === null ? "down" : status.state}`}
        aria-hidden="true"
      />
      <span className="collapsible">
        {label}
        {adapter ? <span className="muted"> · {adapter}</span> : null}
        {status?.game ? (
          <span className="muted"> · {status.game.name}</span>
        ) : null}
      </span>
    </div>
  );
}

function NavLink({
  target,
  label,
  route,
  live = false,
}: {
  target: ScreenId | "about";
  label: string;
  route: Route;
  live?: boolean;
}) {
  const current = route === target;
  return (
    <a
      className={current ? "nav-item nav-current" : "nav-item"}
      href={hrefFor(target)}
      aria-current={current ? "page" : undefined}
      aria-label={label}
      title={label}
    >
      <Icon name={target} />
      <span className="nav-label collapsible">{label}</span>
      {live ? (
        <span className="live-dot" role="img" aria-label="Battle in progress" />
      ) : null}
    </a>
  );
}

/** The collapsible left sidebar (spec §11.1). Collapsed, it is an icon rail with the same links. */
export function Sidebar({
  route,
  collapsed,
  onToggle,
  status,
  battleLive = false,
}: {
  route: Route;
  collapsed: boolean;
  onToggle: () => void;
  status: StatusResource | null;
  /** A red dot on Battle while a battle is live. Nothing sets it until the battle screen lands. */
  battleLive?: boolean;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <h1 className="app-title collapsible">Pokémon Memory Reader</h1>
        <button
          type="button"
          className="nav-toggle"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls="screens"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            className="icon"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={collapsed ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"} />
          </svg>
        </button>
      </div>
      <nav id="screens" aria-label="Screens">
        {SCREENS.map((screen) => (
          <NavLink
            key={screen.id}
            target={screen.id}
            label={screen.label}
            route={route}
            live={screen.id === "battle" && battleLive}
          />
        ))}
      </nav>
      <div className="sidebar-foot">
        <NavLink target="about" label="About" route={route} />
        <StatusBlock status={status} />
      </div>
    </aside>
  );
}
