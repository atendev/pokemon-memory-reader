import type { StatusResource } from "@pokemon-memory-reader/api/schemas";

const BRIDGE_PATH = "/bridges/mgba.lua";

type Copy = { title: string; body: string };

function problemCopy(status: StatusResource): Copy | null {
  const adapter = status.adapter;
  switch (adapter?.problem) {
    case "unknown_bridge": {
      const answered = adapter.bridge?.bridge;
      return {
        title: "The emulator answered with an unknown bridge",
        body: answered
          ? `A "${answered}" bridge answered where another was expected. Check the adapter ports in Settings, or reload the bridge from this program.`
          : "Something answered, but not with a bridge hello this program knows. An older bridge script does this. Reload the bridge from this program.",
      };
    }
    case "protocol_mismatch":
      return {
        title: "The loaded bridge is the wrong version",
        body: `The bridge speaks protocol ${adapter.bridge?.protocol ?? "—"}, which this program doesn't. Reload the bridge from this program.`,
      };
    case "busy":
      return {
        title: "The bridge is in use",
        body: "Another Pokémon Memory Reader is already connected to it. Close the other one.",
      };
    case "bridge_error":
      return {
        title: "The bridge reported an error",
        body: "The bridge sent something this program could not use. Reload the bridge from this program.",
      };
    default:
      return null;
  }
}

function copyFor(status: StatusResource | null, unsupported: boolean): Copy {
  if (status === null) {
    return {
      title: "Cannot reach the program",
      body: "The viewer lost its connection to Pokémon Memory Reader. It keeps trying, so start the program again if it was closed.",
    };
  }
  if (unsupported) {
    return {
      title: "This game isn't supported yet",
      body: "The game is recognised, but this program can't read that kind of game yet.",
    };
  }
  switch (status.state) {
    case "no_game":
      return {
        title: "No game loaded",
        body: "The emulator is connected. Load a game and the party appears here.",
      };
    case "unidentified": {
      const expansion = status.rom?.expansion;
      return {
        title: "This game isn't recognised",
        body: expansion
          ? `The loaded ROM is an expansion hack (version ${expansion.version}), which this program doesn't read.`
          : "The loaded ROM matches no game profile, so there is nothing to read yet.",
      };
    }
    default:
      return (
        problemCopy(status) ?? {
          title: "Waiting for an emulator",
          body: "Start your emulator and load the bridge script. The viewer connects by itself.",
        }
      );
  }
}

/**
 * Replaces the game screens while there is nothing to read (spec §11.1, §11.2). `unsupported`
 * comes from a resource's 503 `unsupported`, because `status.state` stays `game` for it.
 */
export function ConnectionScreen({
  status,
  unsupported = false,
}: {
  status: StatusResource | null;
  unsupported?: boolean;
}) {
  const copy = copyFor(status, unsupported);
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
