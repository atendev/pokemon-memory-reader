import type { StatusResource } from "@pokemon-memory-reader/api/schemas";
import { useState } from "react";
import type { ManualPicksBody } from "./internal-api";
import type { Polled } from "./useInternal";

type Candidate = ManualPicksBody["candidates"][number];

const SIGNATURE_TEXT = {
  match: "signature matches",
  mismatch: "signature doesn't match",
  unchecked: "signature not checked",
} as const;

/** What a candidate says about itself in the list: its name, how it matched, and its signature read. */
export function candidateLabel(candidate: Candidate): string {
  const notes = [
    candidate.headerMatch ? "header matches" : null,
    candidate.signature ? SIGNATURE_TEXT[candidate.signature] : null,
  ].filter((note) => note !== null);
  return notes.length > 0
    ? `${candidate.name} (${notes.join(", ")})`
    : candidate.name;
}

/** Why a pick can't be made now, or null when it can (amendment 021, item 8). */
export function pickBlock(status: StatusResource | null): string | null {
  if (status === null || status.rom === null)
    return "Load a game in the emulator to pick a profile for it.";
  if (status.rom.expansion)
    return "This ROM is an expansion hack, which can't be picked a profile.";
  if (status.state === "game" && status.game?.match !== "manual")
    return "The game was matched automatically, and an automatic match can't be overridden.";
  return null;
}

function Candidates({
  body,
  busy,
  onPick,
}: {
  body: ManualPicksBody;
  busy: boolean;
  onPick: (profileId: string, scope: "rom" | "base") => void;
}) {
  const [chosen, setChosen] = useState("");
  const [scope, setScope] = useState<"rom" | "base">("rom");
  const selected = body.candidates.find((c) => c.id === chosen);
  const baseAllowed = selected?.baseEligible === true;
  if (body.candidates.length === 0)
    return (
      <p className="body muted">No profile is a candidate for this ROM.</p>
    );
  return (
    <form
      className="pick-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (selected) onPick(selected.id, baseAllowed ? scope : "rom");
      }}
    >
      <div className="setting">
        <label className="setting-label" htmlFor="pick-profile">
          Profile
        </label>
        <select
          id="pick-profile"
          className="input"
          value={chosen}
          onChange={(event) => setChosen(event.target.value)}
        >
          <option value="">Choose a profile</option>
          {body.candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidateLabel(candidate)}
            </option>
          ))}
        </select>
      </div>
      {baseAllowed ? (
        <fieldset className="setting">
          <legend className="setting-label">Remember it for</legend>
          <label className="toggle">
            <input
              type="radio"
              name="pick-scope"
              checked={scope === "rom"}
              onChange={() => setScope("rom")}
            />
            This ROM only
          </label>
          <label className="toggle">
            <input
              type="radio"
              name="pick-scope"
              checked={scope === "base"}
              onChange={() => setScope("base")}
            />
            Any ROM built from this base game, such as a randomizer seed
          </label>
        </fieldset>
      ) : null}
      <button type="submit" className="button" disabled={busy || !selected}>
        Use this profile
      </button>
    </form>
  );
}

/**
 * The manual ROM pick (spec §11.2, amendment 021, item 8). It lists candidates while the ROM is
 * unidentified or manually matched, and forgets a pick that applied. `picks` is null when no pick
 * is possible, so nothing was requested.
 */
export function ManualPickSection({
  status,
  picks,
  busy,
  onPick,
  onForget,
}: {
  status: StatusResource | null;
  picks: Polled<ManualPicksBody> | null;
  busy: boolean;
  onPick: (profileId: string, scope: "rom" | "base") => void;
  onForget: () => void;
}) {
  const block = pickBlock(status);
  const manual = status?.state === "game" && status.game?.match === "manual";
  return (
    <section className="card" aria-labelledby="set-pick">
      <h3 className="headline" id="set-pick">
        Game profile
      </h3>
      {manual ? (
        <div className="pick-current">
          <p className="body">
            Using {status?.game?.name} because you picked it.
          </p>
          <button
            type="button"
            className="button button-quiet"
            disabled={busy}
            onClick={onForget}
          >
            Forget this pick
          </button>
        </div>
      ) : null}
      {block !== null ? (
        <p className="body muted">{block}</p>
      ) : picks === null ? null : picks.kind === "loading" ? (
        <p className="body muted">Reading the candidate profiles.</p>
      ) : picks.kind === "unavailable" ? (
        <p className="body muted" role="alert">
          {picks.status === 404
            ? "This program can't list candidate profiles yet."
            : `The candidate profiles can't be read right now. ${picks.message}`}
        </p>
      ) : (
        <Candidates body={picks.value} busy={busy} onPick={onPick} />
      )}
    </section>
  );
}
