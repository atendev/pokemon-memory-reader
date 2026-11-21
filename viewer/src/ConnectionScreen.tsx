import type { StatusResource } from "@pokemon-memory-reader/api/schemas";
import type { AboutBody } from "@pokemon-memory-reader/internal/about";
import type { AdaptersBody } from "@pokemon-memory-reader/internal/adapters-route";
import type { SettingsBody } from "@pokemon-memory-reader/internal/settings-route";
import { CopyButton } from "./CopyButton";
import { PROBE_TEXT, PROBLEM_TEXT } from "./SettingsScreen";
import { ADAPTER_LABELS } from "./settings-form";
import type { Polled } from "./useInternal";

const BRIDGE_PATH = "/bridges/mgba.lua";

type Copy = { title: string; body: string };

/** How a bridge's protocol number compares with the program's. Null when either is unknown or they match. */
export function protocolRelation(
  bridge: number | null | undefined,
  program: number | null,
): "older" | "newer" | null {
  if (bridge == null || program === null || bridge === program) return null;
  return bridge < program ? "older" : "newer";
}

function mismatchCopy(bridge: number | null, program: number | null): Copy {
  const relation = protocolRelation(bridge, program);
  if (relation === "older") {
    return {
      title: "The loaded bridge is older than this program",
      body: `The bridge speaks protocol ${bridge}, and this program speaks protocol ${program}. Reload the bridge from this program.`,
    };
  }
  if (relation === "newer") {
    return {
      title: "The loaded bridge is newer than this program",
      body: `The bridge speaks protocol ${bridge}, and this program only speaks protocol ${program}. Update this program, or reload the bridge from it.`,
    };
  }
  return {
    title: "The loaded bridge is the wrong version",
    body: `The bridge speaks protocol ${bridge ?? "—"}, which this program doesn't. Reload the bridge from this program.`,
  };
}

function problemCopy(
  status: StatusResource,
  programProtocol: number | null,
): Copy | null {
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
      return mismatchCopy(adapter.bridge?.protocol ?? null, programProtocol);
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

function copyFor(
  status: StatusResource | null,
  unsupported: boolean,
  programProtocol: number | null,
): Copy {
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
        problemCopy(status, programProtocol) ?? {
          title: "Waiting for an emulator",
          body: "Start your emulator and load the bridge script. The viewer connects by itself.",
        }
      );
  }
}

const LOADING = { kind: "loading" } as const;

function DataFolder({ settings }: { settings: Polled<SettingsBody> }) {
  if (settings.kind !== "ready") return null;
  const { paths } = settings.value;
  return (
    <section className="card" aria-labelledby="conn-folder">
      <h3 className="headline" id="conn-folder">
        Data folder
      </h3>
      {paths === null ? (
        <p className="body muted">
          Open the viewer on this machine to see the path.
        </p>
      ) : (
        <>
          <p className="footnote muted">
            The bridge scripts are in its bridges folder.
          </p>
          <p className="conn-path">
            <code className="tabular">{paths.dataFolder}</code>
            <CopyButton
              text={paths.dataFolder}
              label="Copy the data folder path"
            />
          </p>
        </>
      )}
    </section>
  );
}

function adapterNote(
  entry: AdaptersBody["adapters"][number],
  programProtocol: number | null,
): string {
  const { result, problem, bridge } = entry.probe;
  const base = PROBE_TEXT[result] ?? result;
  if (!problem) return base;
  const relation =
    problem === "protocol_mismatch"
      ? protocolRelation(bridge?.protocol, programProtocol)
      : null;
  const detail = relation
    ? `the bridge is ${relation} than this program (protocol ${bridge?.protocol}, this program ${programProtocol})`
    : (PROBLEM_TEXT[problem] ?? problem);
  return `${base}: ${detail}`;
}

function AdapterSummary({
  adapters,
  programProtocol,
}: {
  adapters: Polled<AdaptersBody>;
  programProtocol: number | null;
}) {
  return (
    <section className="card" aria-labelledby="conn-adapters">
      <h3 className="headline" id="conn-adapters">
        Adapters
      </h3>
      {adapters.kind === "loading" ? (
        <p className="body muted">Looking for emulators.</p>
      ) : adapters.kind === "unavailable" ? (
        <p className="body muted" role="alert">
          The adapter list can't be read right now. {adapters.message}
        </p>
      ) : (
        <ul className="adapter-list">
          {adapters.value.adapters.map((entry) => (
            <li key={entry.id} className="adapter-row">
              <div>
                <strong>{ADAPTER_LABELS[entry.id] ?? entry.id}</strong>
                <span className="footnote muted">
                  {" "}
                  {entry.endpoint.host}:{entry.endpoint.port}
                </span>
                <p className="footnote">
                  {adapterNote(entry, programProtocol)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Replaces the game screens while there is nothing to read (spec §11.1, §11.2). `unsupported`
 * comes from a resource's 503 `unsupported`, because `status.state` stays `game` for it. The
 * data folder and the adapter list sit under the message whenever the program answered, and
 * `about` carries the program's protocol number for the older and newer bridge text.
 */
export function ConnectionScreen({
  status,
  unsupported = false,
  settings = LOADING,
  adapters = LOADING,
  about = LOADING,
}: {
  status: StatusResource | null;
  unsupported?: boolean;
  settings?: Polled<SettingsBody>;
  adapters?: Polled<AdaptersBody>;
  about?: Polled<AboutBody>;
}) {
  const programProtocol = about.kind === "ready" ? about.value.protocol : null;
  const copy = copyFor(status, unsupported, programProtocol);
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
      {status === null ? null : (
        <>
          <AdapterSummary
            adapters={adapters}
            programProtocol={programProtocol}
          />
          <DataFolder settings={settings} />
        </>
      )}
    </section>
  );
}
