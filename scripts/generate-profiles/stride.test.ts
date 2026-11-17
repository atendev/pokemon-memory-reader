import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { definitions } from "./definitions";
import { planGeneration } from "./plan";
import { checkSpeciesInfoStride, SPECIES_INFO_STRIDE } from "./stride";
import { parseSymFile } from "./sym";

const fixture = (name: string) =>
  readFileSync(join(import.meta.dir, "fixtures", name), "utf8");
const committed = fixture("pokeemerald.excerpt.sym");
const emerald = definitions[0];
if (!emerald) throw new Error("no definitions");
const table = emerald.speciesInfo;

/** The committed excerpt with the species table resized, as a stand-in for a repo whose entries aren't 0x1C bytes. */
const resized = (size: string, name = "gSpeciesInfo") =>
  parseSymFile(
    committed.replace(/^(\w{8} g )\w{8}( gSpeciesInfo)$/m, `$1${size} ${name}`),
  );

describe("the species-info stride check", () => {
  test("passes on the committed pokeemerald excerpt", () => {
    expect(() =>
      checkSpeciesInfoStride(
        "pret/pokeemerald",
        parseSymFile(committed),
        table,
      ),
    ).not.toThrow();
    expect(SPECIES_INFO_STRIDE).toBe(0x1c);
    expect(table.speciesCount * SPECIES_INFO_STRIDE).toBe(0x2d10);
  });

  test("the species count is the reference data's species count", () => {
    const reference = JSON.parse(
      readFileSync(
        join(import.meta.dir, "../../server/src/reference/data/gen3-en.json"),
        "utf8",
      ),
    ) as { speciesData: unknown[] };
    expect(table.speciesCount).toBe(reference.speciesData.length);
  });

  test("fails a synthetic excerpt, naming the repo, symbol, size and count", () => {
    expect(() =>
      checkSpeciesInfoStride("pret/pokeemerald", resized("00002ca0"), table),
    ).toThrow(
      "pret/pokeemerald: gSpeciesInfo is 0x2ca0 bytes, but 412 species at 0x1c is 0x2d10",
    );
  });

  test("fails a table sized for another stride and one entry short", () => {
    for (const size of ["000027a0", "000030c0", "00002cf4"]) {
      expect(() =>
        checkSpeciesInfoStride("pret/pokeemerald", resized(size), table),
      ).toThrow("412 species at 0x1c");
    }
  });

  test("takes the species count and the symbol name as arguments", () => {
    const symbols = resized("00002d10", "gBaseStats");
    const base = { symbol: "gBaseStats", speciesCount: 412 };
    expect(() =>
      checkSpeciesInfoStride("pret/pokefirered", symbols, base),
    ).not.toThrow();
    expect(() =>
      checkSpeciesInfoStride("pret/pokefirered", symbols, {
        ...base,
        speciesCount: 411,
      }),
    ).toThrow("pret/pokefirered: gBaseStats is 0x2d10 bytes");
    expect(() =>
      checkSpeciesInfoStride("pret/pokefirered", symbols, table),
    ).toThrow("symbol gSpeciesInfo is missing");
  });

  test("fails the whole generator run and writes nothing", () => {
    const input = {
      built: [
        {
          definition: emerald,
          pretSha1s: [],
          noIntro: new Map(),
          symbols: resized("00002ca0"),
        },
      ],
      held: [],
      ledger: [],
    };
    expect(() => planGeneration(input)).toThrow(
      "pret/pokeemerald: gSpeciesInfo is 0x2ca0 bytes",
    );
  });
});
