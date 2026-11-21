import type { ArtVersion } from "../../server/src/profile/schema";

/** The PokeAPI `item_game_indices` generation each art version's item IDs follow. */
export const ITEM_GENERATION: Readonly<Record<ArtVersion, number>> = {
  "red-blue": 1,
  "red-green-japan": 1,
  yellow: 1,
  gold: 2,
  silver: 2,
  crystal: 2,
  "ruby-sapphire": 3,
  emerald: 3,
  "firered-leafgreen": 3,
};

/** The PokeAPI version names whose `game_index` is a species' internal ID, per Gen 1 and Gen 2 game. */
export const DEX_VERSIONS = {
  gen1: ["red", "blue", "yellow"],
  gen2: ["gold", "silver", "crystal"],
} as const;

/** Rows read from PokeAPI's CSV data. Item and version IDs are PokeAPI's own, not the games'. */
export interface PokeApiData {
  /** `items.csv`: PokeAPI item ID to its slug. */
  readonly items: ReadonlyMap<number, string>;
  /** `item_names.csv`, English: PokeAPI item ID to its name. */
  readonly itemNames: ReadonlyMap<number, string>;
  /** `item_game_indices.csv`: generation to game index to the PokeAPI item IDs listed there. */
  readonly itemGameIndices: ReadonlyMap<number, ReadonlyMap<number, number[]>>;
  /** `versions.csv`: PokeAPI version ID to its name. */
  readonly versions: ReadonlyMap<number, string>;
  /** `pokemon_game_indices.csv`: PokeAPI version ID to game index to the Pokémon ID listed there. */
  readonly pokemonGameIndices: ReadonlyMap<number, ReadonlyMap<number, number>>;
  /** File names under `sprites/items/` at the pinned sprites SHA, without the `.png`. */
  readonly itemSprites: ReadonlySet<string>;
}

export interface IconMapsInput {
  readonly pokeapi: PokeApiData;
  /** English item names of Gen 3, by item ID, from the checked-in reference data. */
  readonly gen3ItemNames: ReadonlyArray<string | null>;
  readonly spritesSha: string;
  readonly pokeapiCommit: string;
}

export interface IconMapsFile {
  readonly provenance: {
    readonly pokeapiCommit: string;
    readonly spritesSha: string;
  };
  /** National Dex number by internal species ID. */
  readonly dex: {
    readonly gen1: Readonly<Record<number, number>>;
    readonly gen2: Readonly<Record<number, number>>;
  };
  /** PokeAPI item slug by item ID, for each art version. Only slugs with art at `spritesSha` are listed. */
  readonly items: Readonly<
    Record<ArtVersion, Readonly<Record<number, string>>>
  >;
}

const FILLER_ITEM = "????????";
/** Pokémon IDs past this are alternate forms, and no Gen 1-3 game uses them. */
const LAST_SPECIES = 386;

const normalize = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function versionId(data: PokeApiData, name: string): number {
  for (const [id, versionName] of data.versions)
    if (versionName === name) return id;
  throw new Error(`PokeAPI has no version ${name}`);
}

/**
 * Internal species ID to dex number. Every version of a generation must agree, or the table would
 * be wrong for one of its games and the build says so.
 */
function dexTable(
  data: PokeApiData,
  names: readonly string[],
): Record<number, number> {
  let merged: Map<number, number> | null = null;
  let first = "";
  for (const name of names) {
    const rows = new Map<number, number>();
    for (const [index, pokemon] of data.pokemonGameIndices.get(
      versionId(data, name),
    ) ?? [])
      if (pokemon <= LAST_SPECIES) rows.set(index, pokemon);
    if (merged === null) {
      merged = rows;
      first = name;
      continue;
    }
    const same =
      rows.size === merged.size &&
      [...rows].every(([index, dex]) => merged?.get(index) === dex);
    if (!same) throw new Error(`${first} and ${name} number species apart`);
  }
  if (merged === null || merged.size === 0)
    throw new Error(`no species indices for ${names.join(", ")}`);
  return Object.fromEntries([...merged].sort(([a], [b]) => a - b));
}

/** Gen 3 names PokeAPI spells another way, where its `game_index` lists two items and the name has to pick one. */
const RENAMED: Readonly<Record<string, string>> = {
  ITEMFINDER: "dowsing-machine",
};

/** PokeAPI items by normalised English name and by slug, for the names that no `game_index` settles. */
function byName(data: PokeApiData): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const slug of data.items.values())
    out.set(normalize(slug), [...(out.get(normalize(slug)) ?? []), slug]);
  for (const [name, slug] of Object.entries(RENAMED))
    out.set(normalize(name), [slug]);
  for (const [id, name] of data.itemNames) {
    const slug = data.items.get(id);
    if (slug === undefined) continue;
    const key = normalize(name);
    out.set(key, [...(out.get(key) ?? []), slug]);
  }
  return out;
}

/**
 * Item ID to slug for one art version. A slug with no art at the pinned SHA is left out, because
 * the table lists what resolves. A `game_index` that PokeAPI gives to two items is left out too,
 * unless the game's own English name picks one (Gen 3 only, since Gen 1-2 ship no item names).
 */
function itemTable(
  data: PokeApiData,
  generation: number,
  gameNames: ReadonlyArray<string | null> | null,
  nameIndex: ReadonlyMap<string, readonly string[]>,
): Record<number, string> {
  const out: Record<number, string> = {};
  const indices = data.itemGameIndices.get(generation) ?? new Map();
  const ids = gameNames
    ? gameNames.flatMap((name, id) =>
        name !== null && name !== FILLER_ITEM ? [id] : [],
      )
    : [...indices.keys()];
  for (const id of ids) {
    const listed = (indices.get(id) ?? []).flatMap((itemId: number) => {
      const slug = data.items.get(itemId);
      return slug === undefined ? [] : [slug];
    });
    const name = gameNames?.[id];
    let slug: string | undefined;
    if (listed.length === 1) slug = listed[0];
    else if (listed.length > 1 && name) {
      const wanted = nameIndex.get(normalize(name)) ?? [];
      const picked = listed.filter((candidate: string) =>
        wanted.includes(candidate),
      );
      if (picked.length === 1) slug = picked[0];
    } else if (listed.length === 0 && name) {
      const wanted = nameIndex.get(normalize(name)) ?? [];
      if (wanted.length === 1) slug = wanted[0];
    }
    if (slug !== undefined && data.itemSprites.has(slug)) out[id] = slug;
  }
  return Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => Number(a) - Number(b)),
  );
}

export function buildIconMaps(input: IconMapsInput): IconMapsFile {
  const { pokeapi } = input;
  const nameIndex = byName(pokeapi);
  const items = Object.fromEntries(
    (Object.entries(ITEM_GENERATION) as [ArtVersion, number][]).map(
      ([artVersion, generation]) => [
        artVersion,
        itemTable(
          pokeapi,
          generation,
          generation === 3 ? input.gen3ItemNames : null,
          nameIndex,
        ),
      ],
    ),
  ) as IconMapsFile["items"];
  return {
    provenance: {
      pokeapiCommit: input.pokeapiCommit,
      spritesSha: input.spritesSha,
    },
    dex: {
      gen1: dexTable(pokeapi, DEX_VERSIONS.gen1),
      gen2: dexTable(pokeapi, DEX_VERSIONS.gen2),
    },
    items,
  };
}

/** The checked-in file's text. One entry a line, so a regenerate diffs by entry. */
export function renderIconMaps(file: IconMapsFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** Splits one CSV line. A cell in double quotes may hold commas and doubled quotes. */
function splitLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line.charAt(i);
    if (quoted) {
      if (char === '"' && line.charAt(i + 1) === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(cell);
      cell = "";
    } else cell += char;
  }
  cells.push(cell);
  return cells;
}

/** Reads one of PokeAPI's CSV files into rows keyed by column name. */
export function parseCsv(text: string): Record<string, string>[] {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const columns = splitLine(head ?? "");
  return lines.map((line) => {
    const cells = splitLine(line);
    return Object.fromEntries(
      columns.map((column, index) => [column, cells[index] ?? ""]),
    );
  });
}

/** Builds the lookup maps from the CSV files. `itemSprites` come from the sprites repo's listing. */
export function readPokeApi(
  files: Readonly<
    Record<
      | "items"
      | "item_names"
      | "item_game_indices"
      | "versions"
      | "pokemon_game_indices",
      string
    >
  >,
  itemSprites: ReadonlySet<string>,
): PokeApiData {
  const english = 9;
  const itemGameIndices = new Map<number, Map<number, number[]>>();
  for (const row of parseCsv(files.item_game_indices)) {
    const generation = Number(row.generation_id);
    const byIndex = itemGameIndices.get(generation) ?? new Map();
    const index = Number(row.game_index);
    byIndex.set(index, [...(byIndex.get(index) ?? []), Number(row.item_id)]);
    itemGameIndices.set(generation, byIndex);
  }
  const pokemonGameIndices = new Map<number, Map<number, number>>();
  for (const row of parseCsv(files.pokemon_game_indices)) {
    const version = Number(row.version_id);
    const byIndex = pokemonGameIndices.get(version) ?? new Map();
    byIndex.set(Number(row.game_index), Number(row.pokemon_id));
    pokemonGameIndices.set(version, byIndex);
  }
  return {
    items: new Map(
      parseCsv(files.items).map((row) => [
        Number(row.id),
        row.identifier ?? "",
      ]),
    ),
    itemNames: new Map(
      parseCsv(files.item_names)
        .filter((row) => Number(row.local_language_id) === english)
        .map((row) => [Number(row.item_id), row.name ?? ""]),
    ),
    itemGameIndices,
    versions: new Map(
      parseCsv(files.versions).map((row) => [
        Number(row.id),
        row.identifier ?? "",
      ]),
    ),
    pokemonGameIndices,
    itemSprites,
  };
}
