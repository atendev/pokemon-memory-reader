import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { definitions, heldBack } from "./definitions";
import { parseLedger } from "./evidence";
import { parseNoIntroDat, parsePretSha1 } from "./hashes";
import { NOTES_FILE, planGeneration } from "./plan";
import { parseSymFile } from "./sym";

const fixture = (name: string) =>
  readFileSync(join(import.meta.dir, "fixtures", name), "utf8");
const noIntro = parseNoIntroDat(fixture("no-intro-gba.excerpt.dat"));
const symbols = parseSymFile(fixture("pokeemerald.excerpt.sym"));
const emerald = definitions[0];
const sapphire = heldBack[0];
if (!emerald || !sapphire) throw new Error("no definitions");
const emeraldSha1 = parsePretSha1(fixture("pokeemerald.rom.sha1"), "rom.sha1");
const sapphireSha1 = parsePretSha1(
  fixture("pokeruby.sapphire_de.sha1"),
  "sapphire_de.sha1",
);
const committed = parseLedger(
  readFileSync(join(import.meta.dir, "signature-ledger.json"), "utf8"),
);
const BUILTIN = join(import.meta.dir, "../../server/src/profile/builtin");

// A second pokeemerald revision whose SHA-1 is a real No-Intro entry in the excerpt (Spanish Sapphire Rev 1).
const second = {
  ...emerald,
  id: "emerald-xx-1.0",
  name: "Second revision",
};
const secondSha1 = ["0fe9ad1e602e2fafa090aee25e43d6980625173c"];
const firstOwned = [
  { profileId: emerald.id, sha1: emeraldSha1[0] ?? "", date: "2026-11-16" },
];

const input = {
  built: [
    { definition: emerald, pretSha1s: emeraldSha1, noIntro, symbols },
    { definition: second, pretSha1s: secondSha1, noIntro, symbols },
  ],
  held: [{ held: sapphire, pretSha1s: sapphireSha1, noIntro }],
};
const level = (files: Map<string, string>, id: string) =>
  JSON.parse(files.get(`${id}.json`) ?? "{}").provenance.signatureEvidence;

describe("the generator on the checked-in excerpts", () => {
  test("rates owner, chain and unconfirmed through the generated profiles", () => {
    const owned = planGeneration({ ...input, ledger: firstOwned }).files;
    expect(level(owned, emerald.id)).toBe("owner");
    expect(level(owned, second.id)).toBe("chain");
    const none = planGeneration({ ...input, ledger: [] }).files;
    expect(level(none, emerald.id)).toBe("unconfirmed");
    expect(level(none, second.id)).toBe("unconfirmed");
  });

  test("holds back Sapphire German 1.0: a message, no profile file, and the run still succeeds", () => {
    const { files, messages } = planGeneration({ ...input, ledger: [] });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("held back sapphire-de-1.0");
    expect([...files.keys()].filter((k) => k.includes("sapphire"))).toEqual([]);
    expect(files.get("index.ts")).not.toContain("sapphire");
  });

  test("a built revision with a broken chain still fails the run", () => {
    expect(() =>
      planGeneration({
        built: [
          { definition: emerald, pretSha1s: sapphireSha1, noIntro, symbols },
        ],
        held: [],
        ledger: [],
      }),
    ).toThrow("has no entry with SHA-1");
  });

  test("a ledger entry with a SHA-1 the profile doesn't list fails the run", () => {
    expect(() =>
      planGeneration({
        ...input,
        ledger: [
          { profileId: emerald.id, sha1: "0".repeat(40), date: "2026-11-16" },
        ],
      }),
    ).toThrow("identify.sha1");
  });

  test("the notes file names each profile that isn't owner", () => {
    const { files } = planGeneration({ ...input, ledger: firstOwned });
    const notes = files.get(NOTES_FILE) ?? "";
    expect(notes).toContain("- Second revision (emerald-xx-1.0): chain");
    expect(notes).not.toContain("(emerald-us-1.0)");
  });
});

describe("the committed output", () => {
  test("the notes file matches what the generator writes for the committed ledger", () => {
    const { files } = planGeneration({
      built: [
        { definition: emerald, pretSha1s: emeraldSha1, noIntro, symbols },
      ],
      held: [],
      ledger: committed,
    });
    expect(readFileSync(join(BUILTIN, NOTES_FILE), "utf8")).toBe(
      files.get(NOTES_FILE) ?? "",
    );
  });
});
