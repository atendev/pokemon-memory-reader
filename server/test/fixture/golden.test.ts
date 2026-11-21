import { describe, expect, test } from "bun:test";
import {
  assertGolden,
  diffValues,
  parseGolden,
} from "../../src/fixture/golden";

const golden = parseGolden(
  JSON.stringify({
    resources: {
      party: {
        pokemon: [
          { nickname: "LEAFY", level: 5, moves: [33, 52], heldItem: null },
        ],
      },
    },
    verified: ["party.pokemon[0].level"],
  }),
);
const same = () => ({
  party: {
    pokemon: [{ nickname: "LEAFY", level: 5, moves: [33, 52], heldItem: null }],
  },
});

describe("golden files", () => {
  test("equal values pass, and undefined fields count as absent like JSON", () => {
    assertGolden(golden, same());
    assertGolden(golden, {
      party: { pokemon: [{ ...same().party.pokemon[0], extra: undefined }] },
    });
  });

  test("a changed value fails with the path, the golden and the decoded value", () => {
    const actual = same();
    (actual.party.pokemon[0] as { level: number }).level = 6;
    expect(() => assertGolden(golden, actual, "party.expected.json")).toThrow(
      /party\.expected\.json: 1 decoded value differs from the golden\n {2}party\.pokemon\[0\]\.level: expected 5, got 6/,
    );
  });

  test("lists every difference: array length, missing, extra and null keys", () => {
    const lines = diffValues(golden.resources, {
      party: {
        pokemon: [
          {
            nickname: "LEAFY",
            level: 5,
            moves: [33],
            heldItem: 13,
            shiny: true,
          },
          {},
        ],
      },
    });
    expect(lines).toEqual([
      "party.pokemon.length: expected 1, got 2",
      "party.pokemon[0].moves.length: expected 2, got 1",
      "party.pokemon[0].heldItem: expected null, got 13",
      "party.pokemon[0].shiny: not in the golden, got true",
    ]);
    expect(diffValues({ a: 1 }, {})).toEqual([
      "a: expected 1, but it is missing",
    ]);
  });

  test("a malformed golden is rejected", () => {
    expect(() =>
      parseGolden(JSON.stringify({ resources: {} }), "g.json"),
    ).toThrow(/g\.json/);
  });
});
