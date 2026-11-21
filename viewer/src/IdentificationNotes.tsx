import type { StatusResource } from "@pokemon-memory-reader/api/schemas";
import { identificationNotes, missingFieldNotes } from "./notes";

/** The notes about how sure identification is and which fields the profile can't read. Shows nothing when there are none. */
export function IdentificationNotes({
  game,
}: {
  game: StatusResource["game"] | undefined;
}) {
  if (!game) return null;
  const notes = [...identificationNotes(game), ...missingFieldNotes(game)];
  if (notes.length === 0) return null;
  return (
    <ul className="id-notes" aria-label="Identification notes">
      {notes.map((note) => (
        <li
          key={note.text}
          className={`footnote ${note.kind === "warning" ? "warning" : "muted"}`}
        >
          {note.text}
        </li>
      ))}
    </ul>
  );
}
