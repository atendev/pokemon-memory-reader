import type { StatusResource } from "@pokemon-memory-reader/api/schemas";
import { connectionLabel } from "./display";
import { EmptyState } from "./EmptyState";
import { PartyScreen } from "./PartyScreen";
import { useParty, useStatus } from "./useResource";

export function StatusBlock({ status }: { status: StatusResource | null }) {
  const adapter =
    status?.adapter?.bridge?.emulator?.name ?? status?.adapter?.id;
  return (
    <div className="status" role="status">
      <span
        className={`dot dot-${status === null ? "down" : status.state}`}
        aria-hidden="true"
      />
      <span>{connectionLabel(status)}</span>
      {adapter ? <span className="muted">· {adapter}</span> : null}
      {status?.game ? (
        <span className="muted">· {status.game.name}</span>
      ) : null}
    </div>
  );
}

export function Screen({
  status,
  party,
}: {
  status: StatusResource | null;
  party: ReturnType<typeof useParty>;
}) {
  if (status === null || status.state !== "game") {
    return <EmptyState status={status} />;
  }
  return <PartyScreen party={party} />;
}

export function App() {
  const status = useStatus();
  const known = status.kind === "ready" ? status.value : null;
  const party = useParty(known?.state === "game");
  return (
    <div className="page">
      <header className="bar">
        <h1 className="app-title">Pokémon Memory Reader</h1>
        <StatusBlock status={known} />
      </header>
      <main>
        {status.kind === "loading" ? null : (
          <Screen status={known} party={party} />
        )}
      </main>
    </div>
  );
}
