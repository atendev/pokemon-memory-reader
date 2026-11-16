import type { Extracted, MoveRow, SpeciesRow } from "./extract";

export interface ReferenceFile {
  readonly dataFormat: "gen3";
  readonly language: "en";
  readonly provenance: ReadonlyArray<{
    readonly repo: string;
    readonly commit: string;
    readonly files: readonly string[];
  }>;
  /** Byte to glyph for strings of non-Japanese mons and for Japanese mons (amendment 019 §5). 256 entries, null where unmapped. */
  readonly charmap: {
    readonly latin: ReadonlyArray<string | null>;
    readonly kana: ReadonlyArray<string | null>;
  };
  /** Index is the game's ID. Index 0 and unnamed IDs are null. */
  readonly names: {
    readonly species: ReadonlyArray<string | null>;
    readonly moves: ReadonlyArray<string | null>;
    readonly items: ReadonlyArray<string | null>;
    readonly abilities: ReadonlyArray<string | null>;
  };
  /** Index is the species ID. `dex` is the National Dex number. */
  readonly speciesData: ReadonlyArray<
    (SpeciesRow & { readonly dex: number | null }) | null
  >;
  readonly moveData: ReadonlyArray<MoveRow | null>;
}

export interface Source {
  readonly repo: string;
  readonly commit: string;
  readonly files: readonly string[];
  readonly extracted: Extracted;
}

const CONFLICT_LIMIT = 8;

/**
 * Merges one table across repos. Every ID that two repos share must carry the same value, or the
 * table has to move to per-game keys (amendment 019 §4), so this throws and lists the clash.
 */
function agree<T>(
  what: string,
  sources: readonly Source[],
  pick: (extracted: Extracted) => Map<number, T>,
  same: (a: T, b: T) => boolean = (a, b) => a === b,
): Map<number, T> {
  const merged = new Map<number, { value: T; repo: string }>();
  const conflicts: string[] = [];
  for (const source of sources) {
    for (const [id, value] of pick(source.extracted)) {
      const seen = merged.get(id);
      if (!seen) merged.set(id, { value, repo: source.repo });
      else if (!same(seen.value, value)) {
        conflicts.push(
          `${what} ${id}: ${seen.repo} ${JSON.stringify(seen.value)} vs ${source.repo} ${JSON.stringify(value)}`,
        );
      }
    }
  }
  if (conflicts.length) {
    const shown = conflicts.slice(0, CONFLICT_LIMIT).join("\n  ");
    const more =
      conflicts.length > CONFLICT_LIMIT
        ? `\n  and ${conflicts.length - CONFLICT_LIMIT} more`
        : "";
    throw new Error(
      `${what} disagree between repos, so the table needs per-game keys:\n  ${shown}${more}`,
    );
  }
  return new Map([...merged].map(([id, entry]) => [id, entry.value]));
}

/** Glyphs two pret repos spell differently for one byte. The first is rewritten to the second before comparing. */
const GLYPH_ALIASES: Readonly<Record<string, string>> = { "\u22ef": "\u2025" };

const canonical = (glyph: string) => GLYPH_ALIASES[glyph] ?? glyph;

/**
 * Charmaps agree when each byte shares a glyph in every repo that maps it. A byte with several glyphs
 * takes its plain ASCII one, since pret writes names such as FARFETCH'D with it, else its first.
 */
function agreeCharmap(
  sources: readonly Source[],
  pick: (extracted: Extracted) => Map<number, string[]>,
): Array<string | null> {
  const out: Array<string | null> = new Array(256).fill(null);
  const seen = new Map<number, { glyphs: string[]; repo: string }>();
  for (const source of sources) {
    for (const [byte, raw] of pick(source.extracted)) {
      const glyphs = raw.map(canonical);
      const before = seen.get(byte);
      if (!before) {
        seen.set(byte, { glyphs, repo: source.repo });
        out[byte] =
          glyphs.find((glyph) => glyph < "\u007f") ?? glyphs[0] ?? null;
      } else if (!glyphs.some((glyph) => before.glyphs.includes(glyph))) {
        throw new Error(
          `charmap byte 0x${byte.toString(16)}: ${before.repo} ${JSON.stringify(before.glyphs)} vs ${source.repo} ${JSON.stringify(glyphs)}`,
        );
      }
    }
  }
  return out;
}

function table<T>(merged: Map<number, T>): Array<T | null> {
  const size = Math.max(0, ...merged.keys()) + 1;
  return Array.from({ length: size }, (_, id) => merged.get(id) ?? null);
}

export function buildReference(sources: readonly Source[]): ReferenceFile {
  const species = agree("species name", sources, (x) => x.species);
  const speciesData = agree(
    "species data",
    sources,
    (x) => x.speciesData,
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
  const dex = agree("National Dex number", sources, (x) => x.dex);
  const lastSpecies = Math.max(...species.keys());
  const rows = new Map<number, ReferenceFile["speciesData"][number]>();
  for (const [id, row] of speciesData) {
    if (id <= lastSpecies) rows.set(id, { ...row, dex: dex.get(id) ?? null });
  }
  return {
    dataFormat: "gen3",
    language: "en",
    provenance: sources.map(({ repo, commit, files }) => ({
      repo,
      commit,
      files,
    })),
    charmap: {
      latin: agreeCharmap(sources, (x) => x.latin),
      kana: agreeCharmap(sources, (x) => x.kana),
    },
    names: {
      species: table(species),
      moves: table(agree("move name", sources, (x) => x.moves)),
      items: table(agree("item name", sources, (x) => x.items)),
      abilities: table(agree("ability name", sources, (x) => x.abilities)),
    },
    speciesData: table(rows),
    moveData: table(
      agree(
        "move data",
        sources,
        (x) => x.moveData,
        (a, b) => a.type === b.type && a.pp === b.pp,
      ),
    ),
  };
}

/** One table row per line, so a regenerated file diffs by entry. */
export function renderReference(file: ReferenceFile): string {
  const rows = (list: ReadonlyArray<unknown>) =>
    `[\n${list.map((row) => `    ${JSON.stringify(row)}`).join(",\n")}\n  ]`;
  const names = file.names;
  return `${[
    "{",
    `  "dataFormat": ${JSON.stringify(file.dataFormat)},`,
    `  "language": ${JSON.stringify(file.language)},`,
    `  "provenance": ${JSON.stringify(file.provenance)},`,
    `  "charmap": {`,
    `    "latin": ${JSON.stringify(file.charmap.latin)},`,
    `    "kana": ${JSON.stringify(file.charmap.kana)}`,
    "  },",
    `  "names": {`,
    `    "species": ${JSON.stringify(names.species)},`,
    `    "moves": ${JSON.stringify(names.moves)},`,
    `    "items": ${JSON.stringify(names.items)},`,
    `    "abilities": ${JSON.stringify(names.abilities)}`,
    "  },",
    `  "speciesData": ${rows(file.speciesData)},`,
    `  "moveData": ${rows(file.moveData)}`,
    "}",
  ].join("\n")}\n`;
}
