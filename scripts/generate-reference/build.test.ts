import { describe, expect, test } from "bun:test";
import { buildReference, renderReference, type Source } from "./build";
import { evaluate, readConstants, readEntries, stringLiteral } from "./c";
import { extract, type Files } from "./extract";

/** Hand-written inputs in pret's syntax. None of it is copied from a pret file. */
const emeraldFiles: Files = {
  speciesConstants:
    "#define SPECIES_NONE 0\n#define SPECIES_FOO 1\n#define SPECIES_BAR 2\n",
  moveConstants: "#define MOVE_NONE 0\n#define MOVE_HIT 1\n",
  itemConstants:
    "enum {\n ITEM_NONE,\n ITEM_BALL,\n ITEM_034,\n ITEM_TM01,\n};\n",
  abilityConstants: "#define ABILITY_NONE 0\n#define ABILITY_ONE 1\n",
  pokemonConstants:
    "#define TYPE_NORMAL 0\n#define TYPE_FIRE 10\n#define MON_GENDERLESS 0xFF\n#define GROWTH_FAST 4\n",
  growthConstants: "#define GROWTH_MEDIUM_SLOW 3\n",
  pokedexConstants: "#define NATIONAL_DEX_FOO 7\n#define NATIONAL_DEX_BAR 8\n",
  speciesNames: '[SPECIES_FOO] = _("FOO"),\n[SPECIES_BAR] = _("BAR"),\n',
  moveNames: '[MOVE_HIT] = _("HIT"),\n',
  abilityNames: '[ABILITY_ONE] = _("ONE"),\n',
  items: `
    [ITEM_BALL] =
    {
        .name = _("BALL"),
        .itemId = ITEM_BALL,
    },
    [ITEM_034] =
    {
        .name = _("????????"),
        .itemId = ITEM_NONE,
    },
    [ITEM_TM_HIT] =
    {
        .name = _("TM01"),
        .itemId = ITEM_TM01,
    },
  `,
  speciesInfo: `
    #define SAME_TYPES { \\
        .types = {TYPE_NORMAL, TYPE_NORMAL}, \\
        .genderRatio = MON_GENDERLESS, \\
        .growthRate = GROWTH_FAST, \\
        .abilities = {ABILITY_ONE, ABILITY_NONE}, \\
    }
    [SPECIES_FOO] =
    {
        .types = {TYPE_FIRE, TYPE_NORMAL},
        .genderRatio = PERCENT_FEMALE(12.5),
        .growthRate = GROWTH_MEDIUM_SLOW,
        .abilities = {ABILITY_ONE, ABILITY_NONE},
    },
    [SPECIES_BAR] = SAME_TYPES,
  `,
  moveInfo:
    "[MOVE_HIT] =\n{\n .effect = 0,\n .type = TYPE_FIRE,\n .pp = 25,\n},\n",
  dexOrder:
    "const u16 gSpeciesToNationalPokedexNum[] = {\n SPECIES_TO_NATIONAL(FOO),\n SPECIES_TO_NATIONAL(BAR),\n};\n",
  charmap:
    "@ Latin\n'A' = BB\n'\\'' = B4\n'’' = B4\n'…' = B0\nPKMN = 53 54\n@ Hiragana\n'あ' = 01\n'‥' = B0\n@ string placeholders\n'Z' = D4\n",
};

const withFiles = (changes: Partial<Files>): Files => ({
  ...emeraldFiles,
  ...changes,
});

const source = (repo: string, files: Files): Source => ({
  repo,
  commit: "0".repeat(40),
  files: ["a"],
  extracted: extract("emerald", files),
});

describe("string readers", () => {
  test("a pret string literal gives its text", () => {
    expect(stringLiteral('_("FARFETCH\\\'D")')).toBe("FARFETCH'D");
  });

  test("a control code that prints fixed text becomes that text", () => {
    expect(stringLiteral('_("{POKEBLOCK} CASE")')).toBe("POKéBLOCK CASE");
  });

  test("any other control code fails", () => {
    expect(() => stringLiteral('_("{PLAYER}")')).toThrow(
      "unhandled control code",
    );
  });
});

describe("constants", () => {
  test("evaluates sums over known names", () => {
    expect(
      evaluate(
        "A + (B - 1)",
        new Map([
          ["A", 2],
          ["B", 4],
        ]),
      ),
    ).toBe(5);
    expect(evaluate("A + C", new Map([["A", 2]]))).toBeNull();
  });

  test("reads defines that refer to each other and enum bodies", () => {
    const constants = readConstants(
      "#define B A + 1\n#define A 4\nenum { X, Y = 9, Z };\n",
    );
    expect(constants.get("B")).toBe(5);
    expect([
      constants.get("X"),
      constants.get("Y"),
      constants.get("Z"),
    ]).toEqual([0, 9, 10]);
  });

  test("a table entry written as a macro name resolves through the macro", () => {
    const entries = readEntries(
      "[ID_ONE] = BODY,",
      /ID_\w+/,
      new Map([["BODY", "{ .a = 1 }"]]),
    );
    expect(entries.get("ID_ONE")).toBe("{ .a = 1 }");
  });
});

describe("extract", () => {
  const out = extract("emerald", emeraldFiles);

  test("names are keyed by numeric ID and skip ID 0", () => {
    expect([...out.species]).toEqual([
      [1, "FOO"],
      [2, "BAR"],
    ]);
    expect([...out.moves]).toEqual([[1, "HIT"]]);
    expect([...out.abilities]).toEqual([[1, "ONE"]]);
  });

  test("items keep filler names and take a TM's ID from the entry", () => {
    expect([...out.items]).toEqual([
      [1, "BALL"],
      [2, "????????"],
      [3, "TM01"],
    ]);
  });

  test("species data resolves macros, gender percentages and growth rates", () => {
    expect(out.speciesData.get(1)).toEqual({
      types: [10, 0],
      genderRatio: 31,
      growthRate: 3,
      abilities: [1, 0],
    });
    expect(out.speciesData.get(2)).toEqual({
      types: [0, 0],
      genderRatio: 255,
      growthRate: 4,
      abilities: [1, 0],
    });
  });

  test("move data and dex numbers come from their tables", () => {
    expect(out.moveData.get(1)).toEqual({ type: 10, pp: 25 });
    expect([...out.dex]).toEqual([
      [1, 7],
      [2, 8],
    ]);
  });

  test("the charmap splits Latin from kana and stops at the placeholders", () => {
    expect(out.latin.get(0xbb)).toEqual(["A"]);
    expect(out.latin.get(0xb4)).toEqual(["'", "’"]);
    expect(out.kana.get(0x01)).toEqual(["あ"]);
    expect(out.latin.has(0xd4)).toBe(false);
    expect(out.kana.has(0xd4)).toBe(false);
  });

  test("an item at the wrong list position fails", () => {
    const text =
      '{"items":[{"english":"A","itemId":"ITEM_NONE"},{"english":"B","itemId":"ITEM_034"},{"english":"C","itemId":"ITEM_BALL"}]}';
    expect(() => extract("firered", withFiles({ items: text }))).toThrow(
      "list position",
    );
  });
});

describe("buildReference", () => {
  test("merges agreeing repos and renders one table row per line", () => {
    const file = buildReference([
      source("pret/a", emeraldFiles),
      source("pret/b", emeraldFiles),
    ]);
    expect(file.names.species).toEqual([null, "FOO", "BAR"]);
    expect(file.speciesData[1]).toMatchObject({ dex: 7, growthRate: 3 });
    expect(file.charmap.latin[0xb4]).toBe("'");
    expect(file.charmap.kana[0xb0]).toBe("‥");
    expect(renderReference(file).split("\n").length).toBeGreaterThan(10);
    expect(JSON.parse(renderReference(file))).toEqual(file);
  });

  test("a name that differs between repos fails and names both repos", () => {
    const other = withFiles({
      speciesNames: '[SPECIES_FOO] = _("OOF"),\n[SPECIES_BAR] = _("BAR"),\n',
    });
    expect(() =>
      buildReference([source("pret/a", emeraldFiles), source("pret/b", other)]),
    ).toThrow(/species name 1: pret\/a "FOO" vs pret\/b "OOF"/);
  });

  test("the same kana glyph spelled two ways agrees", () => {
    const other = withFiles({
      charmap: emeraldFiles.charmap.replace("'‥' = B0", "'⋯' = B0"),
    });
    expect(
      buildReference([source("pret/a", emeraldFiles), source("pret/b", other)])
        .charmap.kana[0xb0],
    ).toBe("‥");
  });

  test("a byte that two repos map to different glyphs fails", () => {
    const other = withFiles({
      charmap: emeraldFiles.charmap.replace("'A' = BB", "'B' = BB"),
    });
    expect(() =>
      buildReference([source("pret/a", emeraldFiles), source("pret/b", other)]),
    ).toThrow("charmap byte 0xbb");
  });
});
