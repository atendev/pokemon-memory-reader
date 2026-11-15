import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildProfile, renderIndex, renderProfile } from "./build";
import { definitions } from "./definitions";
import { parseSymFile } from "./sym";

const excerpt = readFileSync(
  join(import.meta.dir, "fixtures/pokeemerald.excerpt.sym"),
  "utf8",
);
const definition = definitions[0];
if (!definition) throw new Error("no definitions");

describe("parseSymFile", () => {
  test("keeps global symbols with address and size", () => {
    const symbols = parseSymFile(
      "02000000 l 00000000 ewram\n02024084 g 00000160 gBattleMons\n",
    );
    expect([...symbols.keys()]).toEqual(["gBattleMons"]);
    expect(symbols.get("gBattleMons")).toEqual({
      address: 0x02024084,
      size: 0x160,
    });
  });

  test("rejects a repeated global symbol", () => {
    expect(() =>
      parseSymFile("02000000 g 00000001 a\n02000004 g 00000001 a\n"),
    ).toThrow("duplicate");
  });
});

describe("the Emerald profile", () => {
  const symbols = parseSymFile(excerpt);

  test("is a pure function of the definition and the symbol excerpt", () => {
    const first = renderProfile(buildProfile(definition, symbols));
    const second = renderProfile(
      buildProfile(definition, parseSymFile(excerpt)),
    );
    expect(second).toBe(first);
  });

  test("matches the committed file", () => {
    const committed = readFileSync(
      join(
        import.meta.dir,
        "../../server/src/profile/builtin/emerald-us-1.0.json",
      ),
      "utf8",
    );
    expect(renderProfile(buildProfile(definition, symbols))).toBe(committed);
  });

  test("matches the committed index", () => {
    const committed = readFileSync(
      join(import.meta.dir, "../../server/src/profile/builtin/index.ts"),
      "utf8",
    );
    expect(renderIndex(definitions.map((d) => d.id))).toBe(committed);
  });

  test("records pointers as pointer entries and the signature as little-endian words", () => {
    const built = buildProfile(definition, symbols) as {
      addresses: Record<string, unknown>;
      identify: { signature: Array<{ address: string; bytes: string }> };
    };
    expect(built.addresses.gSaveBlock1).toEqual({
      ptr: "0x03005d8c",
      offset: "0x0",
    });
    expect(built.addresses.gPlayerParty).toBe("0x020244ec");
    expect(built.identify.signature[0]).toEqual({
      address: "0x080001bc",
      bytes: "cc033208",
    });
  });

  test("a missing symbol or a size that isn't a whole number of entries fails", () => {
    const without = new Map(symbols);
    without.delete("gPlayerParty");
    expect(() => buildProfile(definition, without)).toThrow("gPlayerParty");
    const odd = new Map(symbols);
    odd.set("gTrainers", { address: 0x08310030, size: 41 });
    expect(() => buildProfile(definition, odd)).toThrow("multiple");
  });
});
