import {
  type Constants,
  field,
  readConstants,
  readEntries,
  readMacros,
  stringLiteral,
  stripComments,
} from "./c";
import type { Layout, SourceRole } from "./definition";

export interface SpeciesRow {
  /** Raw type IDs as the game stores them. */
  readonly types: readonly [number, number];
  readonly genderRatio: number;
  readonly growthRate: number;
  readonly abilities: readonly [number, number];
}

export interface MoveRow {
  readonly type: number;
  readonly pp: number;
}

/** What one repo says, keyed by the game's numeric IDs. */
export interface Extracted {
  readonly species: Map<number, string>;
  readonly moves: Map<number, string>;
  readonly items: Map<number, string>;
  readonly abilities: Map<number, string>;
  readonly speciesData: Map<number, SpeciesRow>;
  readonly dex: Map<number, number>;
  readonly moveData: Map<number, MoveRow>;
  /** Every glyph the charmap gives a byte, in file order. */
  readonly latin: Map<number, string[]>;
  readonly kana: Map<number, string[]>;
}

export type Files = Readonly<Record<SourceRole, string>>;

const NAME_ENTRY = /\[([A-Z][A-Z0-9_]*)\]\s*=\s*(_\("(?:[^"\\]|\\.)*"\))/g;

function need(constants: Constants, name: string, where: string): number {
  const value = constants.get(name);
  if (value === undefined) throw new Error(`${where}: unknown constant ${name}`);
  return value;
}

/** Lines like `[SPECIES_FOO] = _("FOO"),` to ID to text. ID 0 is skipped (amendment 019 §2). */
function namedTable(text: string, constants: Constants, where: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const match of stripComments(text).matchAll(NAME_ENTRY)) {
    const id = need(constants, match[1] ?? "", where);
    if (id === 0) continue;
    out.set(id, stringLiteral(match[2] ?? ""));
  }
  return out;
}

function rubyAbilities(text: string): Map<number, string> {
  const out = new Map<number, string>();
  let id = 0;
  for (const match of text.matchAll(/\.string\s+"([^"]*)\$"\s*,\s*\d+/g)) {
    if (id > 0) out.set(id, match[1] ?? "");
    id++;
  }
  return out;
}

function items(text: string, layout: Layout, constants: Constants): Map<number, string> {
  const out = new Map<number, string>();
  const put = (constant: string, name: string) => {
    const id = need(constants, constant, "items");
    if (id !== 0) out.set(id, name);
  };
  if (layout === "firered") {
    const json = JSON.parse(text) as { items: Array<{ english: string; itemId: string }> };
    for (const item of json.items) put(item.itemId, item.english);
    return out;
  }
  for (const match of stripComments(text).matchAll(
    /\.name\s*=\s*(_\("(?:[^"\\]|\\.)*"\))\s*,\s*\.itemId\s*=\s*(ITEM_\w+)/g,
  )) {
    put(match[2] ?? "", stringLiteral(match[1] ?? ""));
  }
  return out;
}

function gender(text: string, constants: Constants): number {
  const percent = /^PERCENT_FEMALE\(\s*([\d.]+)\s*\)$/.exec(text);
  if (percent) return Math.floor(Math.min(254, (Number(percent[1]) * 255) / 100));
  return need(constants, text, "genderRatio");
}

function pair(text: string | null, constants: Constants, where: string): [number, number] {
  const inner = /^\{([^}]*)\}$/.exec(text ?? "")?.[1];
  const parts = (inner ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) throw new Error(`${where}: expected two values in ${text}`);
  return [need(constants, parts[0] ?? "", where), need(constants, parts[1] ?? "", where)];
}

function speciesData(
  text: string,
  layout: Layout,
  constants: Constants,
  species: Constants,
): Map<number, SpeciesRow> {
  const out = new Map<number, SpeciesRow>();
  const entries = readEntries(text, /SPECIES_\w+/, readMacros(text));
  for (const [key, body] of entries) {
    const id = need(species, key, "species info");
    if (id === 0) continue;
    const types =
      layout === "ruby"
        ? ([
            need(constants, field(body, "type1") ?? "", `${key} type1`),
            need(constants, field(body, "type2") ?? "", `${key} type2`),
          ] as [number, number])
        : pair(field(body, "types"), constants, `${key} types`);
    const abilities =
      layout === "ruby"
        ? ([
            need(constants, field(body, "ability1") ?? "", `${key} ability1`),
            need(constants, field(body, "ability2") ?? "", `${key} ability2`),
          ] as [number, number])
        : pair(field(body, "abilities"), constants, `${key} abilities`);
    out.set(id, {
      types,
      genderRatio: gender(field(body, "genderRatio") ?? "", constants),
      growthRate: need(constants, field(body, "growthRate") ?? "", `${key} growthRate`),
      abilities,
    });
  }
  return out;
}

function moveData(text: string, constants: Constants, moves: Constants): Map<number, MoveRow> {
  const out = new Map<number, MoveRow>();
  for (const [key, body] of readEntries(text, /MOVE_\w+/)) {
    const id = need(moves, key, "move info");
    if (id === 0) continue;
    const pp = Number(field(body, "pp"));
    if (!Number.isInteger(pp)) throw new Error(`${key}: pp is not a number`);
    out.set(id, { type: need(constants, field(body, "type") ?? "", `${key} type`), pp });
  }
  return out;
}

/** Species ID to National Dex number, from the array pret keeps for it. */
function dexOrder(
  text: string,
  layout: Layout,
  species: Constants,
  dexNumbers: Constants,
): Map<number, number> {
  const clean = stripComments(text);
  const head = /SpeciesToNationalPokedexNum\s*\[[^\]]*\]\s*=\s*\{/.exec(clean);
  if (!head) throw new Error("no species to National Dex array");
  const start = head.index + head[0].length - 1;
  let depth = 0;
  let end = start;
  for (; end < clean.length; end++) {
    if (clean[end] === "{") depth++;
    else if (clean[end] === "}" && --depth === 0) break;
  }
  const body = clean.slice(start + 1, end);
  const out = new Map<number, number>();
  if (layout === "ruby") {
    let slot = 1;
    for (const match of body.matchAll(/NATIONAL_DEX_\w+/g)) {
      out.set(slot++, need(dexNumbers, match[0], "dex"));
    }
    return out;
  }
  for (const match of body.matchAll(/SPECIES_TO_NATIONAL\(\s*(\w+)\s*\)/g)) {
    out.set(
      need(species, `SPECIES_${match[1]}`, "dex"),
      need(dexNumbers, `NATIONAL_DEX_${match[1]}`, "dex"),
    );
  }
  return out;
}

/**
 * pret's charmap holds a Latin set, then kana sets at the same byte values, then control codes.
 * Only quoted single characters are text. `@ Hiragana` starts the kana set and `@ string placeholders` ends it.
 */
function charmap(text: string): {
  latin: Map<number, string[]>;
  kana: Map<number, string[]>;
} {
  const latin = new Map<number, string[]>();
  const kana = new Map<number, string[]>();
  let target: Map<number, string[]> | null = latin;
  for (const line of text.split("\n")) {
    if (line.startsWith("@")) {
      if (/^@\s*Hiragana/.test(line)) target = kana;
      else if (/^@\s*string placeholders/.test(line)) target = null;
      continue;
    }
    const match = /^'(\\'|[^'\\]{1,2})'\s*=\s*([0-9A-Fa-f]{2})\s*(?:@.*)?$/.exec(line.trim());
    if (!match || !target) continue;
    const glyph = (match[1] ?? "").replace("\\'", "'");
    if ([...glyph].length !== 1) continue;
    const byte = Number.parseInt(match[2] ?? "", 16);
    target.set(byte, [...(target.get(byte) ?? []), glyph]);
  }
  return { latin, kana };
}

export function extract(layout: Layout, files: Files): Extracted {
  const species = readConstants(files.speciesConstants);
  const moves = readConstants(files.moveConstants);
  const itemIds = readConstants(files.itemConstants);
  const abilityIds = readConstants(files.abilityConstants);
  const shared = readConstants(files.pokemonConstants, new Map(abilityIds));
  const dexNumbers = readConstants(files.pokedexConstants);
  return {
    species: namedTable(files.speciesNames, species, "species names"),
    moves: namedTable(files.moveNames, moves, "move names"),
    items: items(files.items, layout, itemIds),
    abilities:
      layout === "ruby"
        ? rubyAbilities(files.abilityNames)
        : namedTable(files.abilityNames, abilityIds, "ability names"),
    speciesData: speciesData(files.speciesInfo, layout, shared, species),
    dex: dexOrder(files.dexOrder, layout, species, dexNumbers),
    moveData: moveData(files.moveInfo, shared, moves),
    ...charmap(files.charmap),
  };
}
