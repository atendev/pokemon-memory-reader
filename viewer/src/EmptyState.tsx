import type { StatusResource } from "@pokemon-memory-reader/api/schemas";

const BRIDGE_PATH = "/bridges/mgba.lua";

function copyFor(status: StatusResource | null) {
  if (status === null) {
    return {
      title: "Cannot reach the program",
      body: "The viewer lost its connection to Pokémon Memory Reader. It keeps trying, so start the program again if it was closed.",
    };
  }
  switch (status.state) {
    case "no_game":
      return {
        title: "No game loaded",
        body: "The emulator is connected. Load a game and the party appears here.",
      };
    case "unidentified":
      return {
        title: "This game isn't recognised",
        body: "The loaded ROM matches no game profile, so there is nothing to read yet.",
      };
    default:
      return {
        title: "Waiting for an emulator",
        body: "Start your emulator and load the bridge script. The viewer connects by itself.",
      };
  }
}

export function EmptyState({ status }: { status: StatusResource | null }) {
  const copy = copyFor(status);
  const showInstall = status?.state === "disconnected";
  return (
    <section className="empty" aria-labelledby="empty-title">
      <h2 id="empty-title" className="title-1">
        {copy.title}
      </h2>
      <p className="body muted">{copy.body}</p>
      {showInstall ? (
        <div className="card">
          <h3 className="headline">Load the mGBA bridge</h3>
          <ol className="steps">
            <li>
              <a className="button" href={BRIDGE_PATH} download="mgba.lua">
                Download mgba.lua
              </a>
            </li>
            <li>In mGBA, open Tools &gt; Scripting.</li>
            <li>Choose File &gt; Load script and pick the downloaded file.</li>
          </ol>
        </div>
      ) : null}
    </section>
  );
}
