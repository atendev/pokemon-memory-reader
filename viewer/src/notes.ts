import type { StatusResource } from "@pokemon-memory-reader/api/schemas";

type Game = NonNullable<StatusResource["game"]>;

export type Note = { kind: "info" | "warning"; text: string };

/** Identification notes (spec §5.4, §11.1): a header match, and a manual pick the program couldn't vouch for. */
export function identificationNotes(game: Game): Note[] {
  if (game.match === "header") {
    const by = game.signature === "match" ? "header and signature" : "header";
    return [{ kind: "info", text: `This ROM matched by ${by}, not by hash.` }];
  }
  if (game.match !== "manual") return [];
  if (game.signature === "mismatch") {
    return [
      {
        kind: "warning",
        text: "This ROM's data tables moved, so some values may be wrong.",
      },
    ];
  }
  if (game.signature === "unchecked") {
    return [
      {
        kind: "warning",
        text: "The program couldn't check this ROM, so some values may be wrong.",
      },
    ];
  }
  return [];
}

const NAME_LABELS = {
  species: "species",
  moves: "move",
  items: "item",
  abilities: "ability",
} as const;

const DATA_LABELS = {
  info: "types, gender and ability",
  dex: "dex numbers",
  exp: "levels of boxed Pokémon",
} as const;

function list(items: readonly string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function unavailable(
  sources: Readonly<Record<string, unknown>>,
  labels: Readonly<Record<string, string>>,
): string[] {
  return Object.entries(labels)
    .filter(([key]) => sources[key] === "unavailable")
    .map(([, label]) => label);
}

/**
 * Missing-field notes: a `names` or `speciesData` table the profile can't read leaves its fields
 * null, and a null name shows as `#<id>` (spec §5.5, §11.1).
 */
export function missingFieldNotes(game: Game): Note[] {
  const notes: Note[] = [];
  const names = unavailable(game.names, NAME_LABELS);
  if (names.length > 0) {
    notes.push({
      kind: "info",
      text: `This profile can't read ${list(names)} names, so they show as #<id>.`,
    });
  }
  const data = unavailable(game.speciesData, DATA_LABELS);
  if (data.length > 0) {
    notes.push({
      kind: "info",
      text: `This profile can't read ${list(data)}, so those fields show as — or stay blank.`,
    });
  }
  return notes;
}
