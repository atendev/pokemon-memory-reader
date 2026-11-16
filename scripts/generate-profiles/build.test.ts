import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildProfile, renderIndex, renderProfile } from "./build";
import { definitions } from "./definitions";
import { parseLedger, rateSignatureEvidence } from "./evidence";
import { parseNoIntroDat, parsePretSha1, resolveHashes } from "./hashes";
import { parseSymFile } from "./sym";

const excerpt = readFileSync(
  join(import.meta.dir, "fixtures/pokeemerald.excerpt.sym"),
  "utf8",
);
const definition = definitions[0];
if (!definition) throw new Error("no definitions");

const pretSha1 = readFileSync(
  join(import.meta.dir, "fixtures/pokeemerald.rom.sha1"),
  "utf8",
);
const noIntroDat = readFileSync(
  join(import.meta.dir, "fixtures/no-intro-gba.excerpt.dat"),
  "utf8",
);
const source = { pret: "pret/pokeemerald rom.sha1", noIntro: "excerpt.dat" };
const hashes = resolveHashes(
  parsePretSha1(pretSha1, "rom.sha1"),
  parseNoIntroDat(noIntroDat),
  source,
);

const ledger = parseLedger(
  readFileSync(join(import.meta.dir, "signature-ledger.json"), "utf8"),
);
const evidence =
  rateSignatureEvidence(
    [
      {
        id: definition.id,
        repo: definition.source.repo,
        sha1: hashes.sha1,
      },
    ],
    ledger,
  ).get(definition.id) ?? "unconfirmed";

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
    const first = renderProfile(
      buildProfile(definition, symbols, hashes, evidence),
    );
    const second = renderProfile(
      buildProfile(definition, parseSymFile(excerpt), hashes, evidence),
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
    expect(
      renderProfile(buildProfile(definition, symbols, hashes, evidence)),
    ).toBe(committed);
  });

  test("matches the committed index", () => {
    const committed = readFileSync(
      join(import.meta.dir, "../../server/src/profile/builtin/index.ts"),
      "utf8",
    );
    expect(renderIndex(definitions.map((d) => d.id))).toBe(committed);
  });

  test("records pointers as pointer entries and the signature as little-endian words", () => {
    const built = buildProfile(definition, symbols, hashes, evidence) as {
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
    expect(() => buildProfile(definition, without, hashes, evidence)).toThrow(
      "gPlayerParty",
    );
    const odd = new Map(symbols);
    odd.set("gTrainers", { address: 0x08310030, size: 41 });
    expect(() => buildProfile(definition, odd, hashes, evidence)).toThrow(
      "multiple",
    );
  });
});

describe("hash lists", () => {
  test("take SHA-1 from pret and CRC32 from the No-Intro entry with that SHA-1", () => {
    expect(hashes).toEqual({
      sha1: ["f3ae088181bf583e55daf962a92bb46f4f1d07b7"],
      crc32: ["1f1c08fb"],
    });
  });

  test("parsePretSha1 reads pret's line format and rejects a file with no hash", () => {
    expect(parsePretSha1(`${"A".repeat(40)}  pokeemerald.gba\n`, "f")).toEqual([
      "a".repeat(40),
    ]);
    expect(() => parsePretSha1("<html>", "rom.sha1")).toThrow(
      "rom.sha1 lists no SHA-1",
    );
  });

  test("parseNoIntroDat lowercases hashes and ignores entries it cannot read", () => {
    const dat = parseNoIntroDat(noIntroDat);
    expect(dat.size).toBe(3);
    expect([
      ...(dat.get("f3ae088181bf583e55daf962a92bb46f4f1d07b7") ?? []),
    ]).toEqual(["1f1c08fb"]);
  });

  test("a SHA-1 with no No-Intro entry fails and names the SHA-1 and both sources", () => {
    const missing = "0".repeat(40);
    expect(() =>
      resolveHashes([missing], parseNoIntroDat(noIntroDat), source),
    ).toThrow(
      `No-Intro excerpt.dat has no entry with SHA-1 ${missing} (listed in pret/pokeemerald rom.sha1)`,
    );
  });

  test("entries with one SHA-1 and different CRC32 values fail", () => {
    const sha1 = "f3ae088181bf583e55daf962a92bb46f4f1d07b7";
    const clash = `${noIntroDat}\ngame (\n\trom ( name "x.gba" size 1 crc 00000001 md5 ${"A".repeat(32)} sha1 ${sha1.toUpperCase()} )\n)\n`;
    expect(() => resolveHashes([sha1], parseNoIntroDat(clash), source)).toThrow(
      "different CRC32",
    );
  });
});
