import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { definitions, heldBack } from "./definitions";
import { parseLedger } from "./evidence";
import { brokenChain, parseNoIntroDat, parsePretSha1 } from "./hashes";
import { NOTES_FILE, planGeneration } from "./plan";
import { parseLocalSymbols, parseSymFile } from "./sym";

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

/** The four pokefirered builds, each with its symbol and SHA-1 excerpt from the pinned commits. */
const FIXTURE_NAMES: Record<string, string> = {
  "firered-us-1.0": "pokefirered",
  "firered-us-1.1": "pokefirered_rev1",
  "leafgreen-us-1.0": "pokeleafgreen",
  "leafgreen-us-1.1": "pokeleafgreen_rev1",
};
const frlg = definitions.filter((definition) => definition.id in FIXTURE_NAMES);
const frlgBuilt = frlg.map((definition) => {
  const name = FIXTURE_NAMES[definition.id];
  return {
    definition,
    pretSha1s: parsePretSha1(fixture(`${name}.rom.sha1`), `${name}.sha1`),
    noIntro,
    symbols: parseSymFile(fixture(`${name}.excerpt.sym`)),
  };
});

/** The six pokeruby builds, each with its symbol and SHA-1 excerpt from the pinned commits. */
const RUBY_FIXTURES: Record<string, string> = {
  "ruby-us-1.0": "pokeruby",
  "ruby-us-1.1": "pokeruby_rev1",
  "ruby-us-1.2": "pokeruby_rev2",
  "sapphire-us-1.0": "pokesapphire",
  "sapphire-us-1.1": "pokesapphire_rev1",
  "sapphire-us-1.2": "pokesapphire_rev2",
};
const ruby = definitions.filter((definition) => definition.id in RUBY_FIXTURES);
const rubyBuilt = ruby.map((definition) => {
  const name = RUBY_FIXTURES[definition.id];
  return {
    definition,
    pretSha1s: parsePretSha1(fixture(`${name}.rom.sha1`), `${name}.sha1`),
    noIntro,
    symbols: parseSymFile(fixture(`${name}.excerpt.sym`)),
    locals: parseLocalSymbols(fixture(`${name}.excerpt.sym`)),
  };
});

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
        ...frlgBuilt,
        ...rubyBuilt,
      ],
      held: [],
      ledger: committed,
    });
    expect(readFileSync(join(BUILTIN, NOTES_FILE), "utf8")).toBe(
      files.get(NOTES_FILE) ?? "",
    );
  });
});

describe("the FireRed and LeafGreen builds", () => {
  const { files, messages } = planGeneration({
    built: frlgBuilt,
    held: [],
    ledger: [],
  });
  const profile = (id: string) => JSON.parse(files.get(`${id}.json`) ?? "{}");

  test("all four generate, with no held-back builds", () => {
    expect(frlg).toHaveLength(4);
    expect(messages).toEqual([]);
    for (const { id } of frlg) expect(files.has(`${id}.json`)).toBe(true);
  });

  test("identify by the shared Game Freak signature and the right game code and revision", () => {
    const headers = frlg.map(({ id }) => profile(id).identify.header);
    expect(headers).toEqual([
      { gameCode: "BPRE", revision: 0 },
      { gameCode: "BPRE", revision: 1 },
      { gameCode: "BPGE", revision: 0 },
      { gameCode: "BPGE", revision: 1 },
    ]);
    for (const { id } of frlg) {
      expect(profile(id).identify.signature).toHaveLength(3);
      expect(profile(id).identify.sha1).toHaveLength(1);
    }
  });

  test("have no second opposing trainer address", () => {
    for (const { id } of frlg) {
      expect(profile(id).addresses.gTrainerBattleOpponent_A).toBeDefined();
      expect(profile(id).addresses.gTrainerBattleOpponent_B).toBeUndefined();
    }
  });

  test("derive the trainer table counts from the pokefirered strides of 40, 13 and 2 bytes", () => {
    const { trainerTables } = profile("firered-us-1.0");
    expect(trainerTables.trainers.count * 40).toBe(0x7418);
    expect(trainerTables.classNames.count * 13).toBe(0x56f);
    expect(trainerTables.money.count * 2).toBe(0x1a4);
  });

  test("move the ROM tables between builds and keep the RAM addresses", () => {
    const [a, b] = [profile("firered-us-1.0"), profile("firered-us-1.1")];
    expect(a.addresses.gPlayerParty).toEqual(b.addresses.gPlayerParty);
    expect(a.trainerTables.trainers.base).not.toBe(
      b.trainerTables.trainers.base,
    );
    expect(a.trainerTables.trainers.count).toBe(b.trainerTables.trainers.count);
  });

  test("every pokefirered SHA-1 has a No-Intro entry, so none is held back", () => {
    for (const build of frlgBuilt)
      expect(brokenChain(build.pretSha1s, noIntro)).toEqual([]);
  });

  test("a FireRed revision with a broken chain is held back by the existing mechanism, with no file and no failure", () => {
    const [firered] = frlg;
    if (!firered) throw new Error("no FireRed definition");
    const held = {
      id: firered.id,
      name: firered.name,
      repo: firered.source.repo,
      sha1: firered.sha1,
      noIntro: firered.noIntro,
      reason: "test",
    };
    const bogus = "0".repeat(40);
    const out = planGeneration({
      built: frlgBuilt.filter((b) => b.definition.id !== firered.id),
      held: [{ held, pretSha1s: [bogus], noIntro }],
      ledger: [],
    });
    expect(out.messages[0]).toContain(`held back ${firered.id}`);
    expect(out.messages[0]).toContain(bogus);
    expect(out.files.has(`${firered.id}.json`)).toBe(false);
    expect(out.files.get("index.ts")).not.toContain(firered.id);
  });
});

describe("the Ruby and Sapphire builds", () => {
  const { files, messages } = planGeneration({
    built: rubyBuilt,
    held: [],
    ledger: [],
  });
  const profile = (id: string) => JSON.parse(files.get(`${id}.json`) ?? "{}");

  test("all six English builds generate, with none held back", () => {
    expect(ruby).toHaveLength(6);
    expect(messages).toEqual([]);
    for (const { id } of ruby) expect(files.has(`${id}.json`)).toBe(true);
    for (const build of rubyBuilt)
      expect(brokenChain(build.pretSha1s, noIntro)).toEqual([]);
  });

  test("identify by the right game code and revision and two anchored signature words", () => {
    expect(ruby.map(({ id }) => profile(id).identify.header)).toEqual([
      { gameCode: "AXVE", revision: 0 },
      { gameCode: "AXVE", revision: 1 },
      { gameCode: "AXVE", revision: 2 },
      { gameCode: "AXPE", revision: 0 },
      { gameCode: "AXPE", revision: 1 },
      { gameCode: "AXPE", revision: 2 },
    ]);
    for (const { id } of ruby)
      expect(profile(id).identify.signature).toHaveLength(2);
  });

  test("Ruby 1.0 records the two words of amendment 036", () => {
    expect(profile("ruby-us-1.0").identify.signature).toEqual([
      { address: "0x08026ce4", bytes: "2cb11f08" },
      { address: "0x0839f4e4", bytes: "e3831f08" },
    ]);
  });

  test("have static save and storage addresses, no pointer entries and no second opposing trainer", () => {
    for (const { id } of ruby) {
      const { addresses } = profile(id);
      for (const key of ["gSaveBlock1", "gSaveBlock2", "gPokemonStorage"])
        expect(typeof addresses[key]).toBe("string");
      expect(addresses.gBattleStruct).toBe("0x02000000");
      expect(addresses.gBattleResources).toBeUndefined();
      expect(addresses.gTrainerBattleOpponent_B).toBeUndefined();
    }
  });

  test("count the size-0 money table by hand and the others from their sizes", () => {
    const { trainerTables } = profile("ruby-us-1.0");
    expect(trainerTables.money.count).toBe(55);
    expect(trainerTables.trainers.count * 40).toBe(0x6c70);
    expect(trainerTables.classNames.count * 13).toBe(0x2f2);
  });

  test("carry the four layout constants and no encryption key", () => {
    for (const { id } of ruby) {
      expect(profile(id).constants).toEqual({
        inBattleOffset: 0x43d,
        sideTimerSpikesOffset: 6,
        moneyMultiplierOffset: 0x16056,
        trainerMoneyEntrySize: 4,
      });
      expect(profile(id).player.encryptionKeyOffset).toBeUndefined();
    }
  });
});
