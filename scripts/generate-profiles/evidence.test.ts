import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { heldBack } from "./definitions";
import {
  appendFailure,
  appendLedgerEntry,
  clearFailures,
  ledgerProblems,
  parseFailures,
  parseLedger,
  rateSignatureEvidence,
  renderEvidenceNotes,
  renderLedger,
} from "./evidence";
import { brokenChain, parseNoIntroDat, parsePretSha1 } from "./hashes";
import { describeHoldBack } from "./holdback";
import { recordSignatureCheck } from "./record";

const fixture = (name: string) =>
  readFileSync(join(import.meta.dir, "fixtures", name), "utf8");
const noIntro = parseNoIntroDat(fixture("no-intro-gba.excerpt.dat"));
const emeraldSha1 = parsePretSha1(fixture("pokeemerald.rom.sha1"), "rom.sha1");

const sha = (digit: string) => digit.repeat(40);
const emerald = {
  id: "emerald-us-1.0",
  repo: "pret/pokeemerald",
  sha1: emeraldSha1,
};
const sibling = {
  id: "emerald-xx-1.0",
  repo: "pret/pokeemerald",
  sha1: [sha("a")],
};
const other = {
  id: "firered-us-1.0",
  repo: "pret/pokefirered",
  sha1: [sha("b")],
};
const day = "2026-11-16";

describe("signature evidence levels", () => {
  test("a ledger entry with a SHA-1 the profile lists makes it owner", () => {
    const levels = rateSignatureEvidence(
      [emerald],
      [{ profileId: emerald.id, sha1: emeraldSha1[0] ?? "", date: day }],
    );
    expect(levels.get(emerald.id)).toBe("owner");
  });

  test("another owned revision from the same pret repo makes a revision chain", () => {
    const levels = rateSignatureEvidence(
      [emerald, sibling, other],
      [{ profileId: emerald.id, sha1: emeraldSha1[0] ?? "", date: day }],
    );
    expect(levels.get(sibling.id)).toBe("chain");
  });

  test("a revision whose pret repo has no owned revision is unconfirmed", () => {
    const levels = rateSignatureEvidence(
      [emerald, sibling, other],
      [{ profileId: emerald.id, sha1: emeraldSha1[0] ?? "", date: day }],
    );
    expect(levels.get(other.id)).toBe("unconfirmed");
    expect(rateSignatureEvidence([emerald], []).get(emerald.id)).toBe(
      "unconfirmed",
    );
  });

  test("a ledger entry for another SHA-1 does not make a profile owner, and is reported", () => {
    const stale = [{ profileId: emerald.id, sha1: sha("c"), date: day }];
    expect(rateSignatureEvidence([emerald], stale).get(emerald.id)).toBe(
      "unconfirmed",
    );
    expect(ledgerProblems([emerald], stale)).toHaveLength(1);
    expect(
      ledgerProblems(
        [emerald],
        [{ profileId: "sapphire-de-1.0", sha1: sha("c"), date: day }],
      ),
    ).toEqual([]);
  });
});

describe("the ledger", () => {
  test("parses exact entries and rejects anything else", () => {
    const good = `[{"profileId":"a","sha1":"${sha("a")}","date":"${day}"}]`;
    expect(parseLedger(good)).toHaveLength(1);
    expect(() => parseLedger("{}")).toThrow("not a list");
    expect(() => parseLedger(`[{"profileId":"a"}]`)).toThrow("exactly");
    expect(() =>
      parseLedger(`[{"profileId":"a","sha1":"${sha("A")}","date":"${day}"}]`),
    ).toThrow("sha1");
    expect(() =>
      parseLedger(
        `[{"profileId":"a","sha1":"${sha("a")}","date":"2026-02-30"}]`,
      ),
    ).toThrow("date");
  });

  test("appending keeps one entry per profile and ROM, and sorts on render", () => {
    const first = { profileId: "b", sha1: sha("a"), date: day };
    const again = { ...first, date: "2026-12-01" };
    const one = appendLedgerEntry([], first);
    expect(appendLedgerEntry(one, again)).toEqual(one);
    const two = appendLedgerEntry(one, { ...first, profileId: "a" });
    expect(
      JSON.parse(renderLedger(two)).map(
        (e: { profileId: string }) => e.profileId,
      ),
    ).toEqual(["a", "b"]);
  });

  test("recordSignatureCheck writes a lowercase hash and today's UTC date", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "ledger-")), "ledger.json");
    writeFileSync(path, "[]\n");
    await recordSignatureCheck(
      path,
      { profileId: emerald.id, sha1: (emeraldSha1[0] ?? "").toUpperCase() },
      new Date("2026-11-16T23:59:00Z"),
    );
    expect(parseLedger(readFileSync(path, "utf8"))).toEqual([
      { profileId: emerald.id, sha1: emeraldSha1[0] ?? "", date: day },
    ]);
  });
});

describe("holding back a broken chain", () => {
  const sapphire = heldBack.find((h) => h.id === "sapphire-de-1.0");

  test("Sapphire German 1.0 is in the hold-back list and its pret SHA-1 has no No-Intro entry", () => {
    if (!sapphire) throw new Error("sapphire-de-1.0 is not held back");
    const sha1s = parsePretSha1(
      fixture("pokeruby.sapphire_de.sha1"),
      "sapphire_de.sha1",
    );
    expect(brokenChain(sha1s, noIntro)).toEqual([
      "fa0bd1abe04fea17016f585454d0f1392f342a21",
    ]);
    const outcome = describeHoldBack(sapphire, sha1s, noIntro);
    expect(outcome.repaired).toBe(false);
    expect(outcome.message).toContain("held back sapphire-de-1.0");
    expect(outcome.message).toContain(
      "fa0bd1abe04fea17016f585454d0f1392f342a21",
    );
  });

  test("a hold-back whose chain is repaired says so instead of failing", () => {
    if (!sapphire) throw new Error("sapphire-de-1.0 is not held back");
    const outcome = describeHoldBack(
      sapphire,
      ["5a087835009d552d4c5c1f96be3be3206e378153"],
      noIntro,
    );
    expect(outcome.repaired).toBe(true);
  });

  test("Emerald's chain is intact", () => {
    expect(brokenChain(emeraldSha1, noIntro)).toEqual([]);
  });
});

describe("release notes", () => {
  test("list every profile that isn't owner, with its level", () => {
    const notes = renderEvidenceNotes([
      { id: "b", name: "B", level: "chain" },
      { id: "a", name: "A", level: "unconfirmed" },
      { id: "c", name: "C", level: "owner" },
    ]);
    expect(notes).toContain("- A (a): unconfirmed");
    expect(notes).toContain("- B (b): chain");
    expect(notes).not.toContain("(c)");
  });

  test("say so when every profile is owner", () => {
    expect(
      renderEvidenceNotes([{ id: "c", name: "C", level: "owner" }]),
    ).toContain("Every shipped profile");
  });
});

describe("the failure record", () => {
  const failure = { profileId: "a", repo: "pret/x", sha1: sha("a"), date: day };

  test("parses exact entries and rejects anything else", () => {
    expect(parseFailures(JSON.stringify([failure]))).toEqual([failure]);
    expect(() => parseFailures("{}")).toThrow("not a list");
    expect(() =>
      parseFailures(JSON.stringify([{ ...failure, repo: undefined }])),
    ).toThrow("no repo");
    expect(() =>
      parseFailures(JSON.stringify([{ ...failure, extra: 1 }])),
    ).toThrow("exactly");
  });

  test("a repeat failure keeps the first entry, and a pass clears only its own profile and ROM", () => {
    const one = appendFailure([], failure);
    expect(appendFailure(one, { ...failure, date: "2026-12-01" })).toEqual(one);
    const two = appendFailure(one, { ...failure, sha1: sha("b") });
    expect(clearFailures(two, { profileId: "a", sha1: sha("a") })).toEqual([
      { ...failure, sha1: sha("b") },
    ]);
    expect(clearFailures(two, { profileId: "z", sha1: sha("a") })).toEqual(two);
  });
});
