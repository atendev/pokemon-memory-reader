import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SUPPORTED } from "../../src/format/support";
import {
  type CoverageInputs,
  checkCoverage,
  type FixtureIndex,
  type FoundState,
  renderCoverage,
  scanFixtures,
} from "../support/coverage-guard";
import { COVERAGE_DOC, repoCoverage } from "../support/coverage-report";
import { ALL_SUPPORTED } from "../support/supported";
import {
  PRIMARY_REVISIONS,
  REQUIRED_STATES,
  type RequiredState,
  requiredFor,
} from "./coverage";

const NONE: Record<"gen1" | "gen2" | "gen3" | "cfru", readonly string[]> = {
  gen1: [],
  gen2: [],
  gen3: ["emerald-us-1.0"],
  cfru: [],
};

/** A two-state matrix so each case reads on its own. */
const STATES: readonly RequiredState[] = [
  { slug: "party", tier: 1, state: "A party", verifies: ["party.pokemon"] },
  { slug: "egg", tier: 2, state: "An egg", verifies: [] },
];
const required = (_format: string, tier?: 1 | 2) =>
  STATES.filter((s) => tier === undefined || s.tier === tier);

const found = (over: Partial<FoundState> = {}): FoundState => ({
  fixture: true,
  golden: true,
  draft: false,
  verified: ["party.pokemon"],
  goldenProblem: null,
  ...over,
});

const index = (folders: Record<string, Record<string, FoundState>>) =>
  new Map(
    Object.entries(folders).map(([id, states]) => [
      id,
      new Map(Object.entries(states)),
    ]),
  ) as FixtureIndex;

const inputs = (over: Partial<CoverageInputs>): CoverageInputs => ({
  index: index({}),
  profiles: [{ id: "emerald-us-1.0", dataFormat: "gen3", fixture: "none" }],
  support: SUPPORTED,
  primary: NONE,
  required,
  ...over,
});

describe("the coverage guard", () => {
  test("a supported format fails when a primary revision lacks a tier 1 state", () => {
    const { failures } = checkCoverage(inputs({ support: ALL_SUPPORTED }));
    expect(failures).toEqual([
      "emerald-us-1.0/party: gen3 is supported, so every primary revision needs this tier 1 fixture",
    ]);
  });

  test("an unsupported format with no fixtures passes and lists its gaps", () => {
    const report = checkCoverage(inputs({}));
    expect(report.failures).toEqual([]);
    expect(report.tier2Gaps).toEqual(["emerald-us-1.0/egg"]);
    expect(report.noFixture).toEqual(["emerald-us-1.0"]);
  });

  test("a supported format with every tier 1 state verified passes, and tier 2 gaps never fail", () => {
    const report = checkCoverage(
      inputs({
        support: ALL_SUPPORTED,
        profiles: [
          { id: "emerald-us-1.0", dataFormat: "gen3", fixture: "full" },
        ],
        index: index({ "emerald-us-1.0": { party: found() } }),
      }),
    );
    expect(report.failures).toEqual([]);
    expect(report.tier2Gaps).toEqual(["emerald-us-1.0/egg"]);
  });

  test("a tier 1 golden that doesn't verify a named field fails", () => {
    const { failures } = checkCoverage(
      inputs({
        profiles: [],
        index: index({
          "emerald-us-1.0": { party: found({ verified: [] }) },
        }),
      }),
    );
    expect(failures).toEqual([
      "emerald-us-1.0/party: the golden's verified list lacks party.pokemon",
    ]);
  });

  test("a fixture with no golden, a draft golden and an orphan golden fail", () => {
    const { failures } = checkCoverage(
      inputs({
        profiles: [],
        index: index({
          "emerald-us-1.0": {
            party: found({ golden: false, verified: null }),
            egg: found({ draft: true }),
            other: found({ fixture: false }),
          },
        }),
      }),
    );
    expect(failures).toEqual([
      "emerald-us-1.0/egg: a draft golden is committed, and only the owner promotes it",
      "emerald-us-1.0/other: the golden has no fixture",
      "emerald-us-1.0/party: the fixture has no golden",
    ]);
  });

  test("a folder that matches no profile, and an unreadable golden, fail", () => {
    const { failures } = checkCoverage(
      inputs({
        profiles: [],
        index: index({
          "nope-us-1.0": { party: found() },
          "emerald-us-1.0": {
            party: found({ verified: null, goldenProblem: "bad" }),
          },
        }),
      }),
    );
    expect(failures).toContain(
      "nope-us-1.0: no profile or primary revision has this id",
    );
    expect(failures).toContain(
      "emerald-us-1.0/party: the golden is unreadable (bad)",
    );
  });

  test("a profile's fixture level is checked against its folder", () => {
    const profiles = (fixture: "full" | "smoke" | "none") => [
      { id: "emerald-us-1.0", dataFormat: "gen3", fixture } as const,
    ];
    const withParty = index({ "emerald-us-1.0": { party: found() } });
    expect(
      checkCoverage(inputs({ profiles: profiles("none"), index: withParty }))
        .failures,
    ).toEqual([
      'emerald-us-1.0: the profile says fixture "none" but has a fixture folder',
    ]);
    expect(
      checkCoverage(inputs({ profiles: profiles("smoke"), index: withParty }))
        .failures,
    ).toEqual([
      'emerald-us-1.0/smoke-party: the profile says fixture "smoke" but lacks this smoke fixture',
      'emerald-us-1.0/smoke-player: the profile says fixture "smoke" but lacks this smoke fixture',
    ]);
    expect(
      checkCoverage(inputs({ profiles: profiles("full") })).failures,
    ).toEqual([
      'emerald-us-1.0/party: the profile says fixture "full" but lacks this tier 1 fixture',
    ]);
  });

  test("the lists come back sorted and without repeats", () => {
    const report = checkCoverage(
      inputs({
        primary: { ...NONE, gen3: ["ruby-us-1.0", "emerald-us-1.0"] },
        profiles: [],
      }),
    );
    expect(report.tier2Gaps).toEqual(["emerald-us-1.0/egg", "ruby-us-1.0/egg"]);
    expect(report.noFixture).toEqual(["emerald-us-1.0", "ruby-us-1.0"]);
  });
});

describe("scanFixtures", () => {
  const dirs: string[] = [];
  afterEach(async () => {
    for (const dir of dirs.splice(0)) await rm(dir, { recursive: true });
  });

  test("reads fixtures, goldens and drafts by profile and slug", async () => {
    const root = await mkdtemp(join(tmpdir(), "pmr-coverage-"));
    dirs.push(root);
    await mkdir(join(root, "emerald-us-1.0"));
    const at = (name: string) => join(root, "emerald-us-1.0", name);
    await writeFile(at("party.fixture.json"), "{}");
    await writeFile(at("party.expected.json"), '{"verified":["a"]}');
    await writeFile(at("egg.fixture.json"), "{}");
    await writeFile(at("egg.expected.draft.json"), "{}");
    await writeFile(at("bad.expected.json"), '{"verified":3}');
    await writeFile(join(root, "coverage.ts"), "");
    const scanned = await scanFixtures(root);
    const folder = scanned.get("emerald-us-1.0");
    expect(folder?.get("party")).toMatchObject({
      fixture: true,
      golden: true,
      verified: ["a"],
    });
    expect(folder?.get("egg")).toMatchObject({
      fixture: true,
      golden: false,
      draft: true,
    });
    expect(folder?.get("bad")?.goldenProblem).toContain("verified");
    expect([...scanned.keys()]).toEqual(["emerald-us-1.0"]);
  });

  test("a missing folder is empty", async () => {
    expect((await scanFixtures("/nonexistent-pmr-fixtures")).size).toBe(0);
  });
});

describe("the committed matrix", () => {
  test("slugs are unique kebab-case and tier 1 covers every format", () => {
    const slugs = REQUIRED_STATES.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    for (const format of Object.keys(
      PRIMARY_REVISIONS,
    ) as (keyof typeof PRIMARY_REVISIONS)[])
      expect(requiredFor(format, 1).map((s) => s.slug)).toContain(
        "boxes-filled",
      );
  });

  test("every verification fixture names the fact it proves", () => {
    for (const state of REQUIRED_STATES.filter((s) =>
      s.slug.startsWith("proves-"),
    ))
      expect(state.proves).toBeTruthy();
  });
});

describe("the repo's fixtures", () => {
  test("the guard finds no failure, which is also the support gate for every format flagged supported", async () => {
    const { report } = await repoCoverage();
    expect(report.failures).toEqual([]);
  });

  test("docs/coverage.md is generated from the matrix and isn't stale", async () => {
    const { doc } = await repoCoverage();
    const committed = await Bun.file(COVERAGE_DOC).text();
    expect(
      committed,
      "docs/coverage.md is stale: run `bun run coverage` and commit it",
    ).toBe(doc);
  });

  test("the generated page changes when a flag, a fixture or the matrix does", async () => {
    const base = await repoCoverageDocWith({});
    expect(await repoCoverageDocWith({ support: ALL_SUPPORTED })).not.toBe(
      base,
    );
    expect(
      await repoCoverageDocWith({
        states: [
          ...REQUIRED_STATES,
          { slug: "extra", tier: 2, state: "x", verifies: [] },
        ],
      }),
    ).not.toBe(base);
  });
});

async function repoCoverageDocWith(
  over: Partial<CoverageInputs> & { states?: readonly RequiredState[] },
): Promise<string> {
  const { repoCoverageInputs } = await import("../support/coverage-report");
  const real = await repoCoverageInputs();
  return renderCoverage({ ...real, states: REQUIRED_STATES, ...over });
}
