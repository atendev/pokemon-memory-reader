import { describe, expect, test } from "bun:test";
import {
  appendOnlyViolations,
  BASELINE_FILE,
  type Baseline,
  currentBaseline,
  DOCS_FILE,
  documentedEnums,
  recordsBlock,
  renderRecords,
} from "../scripts/open-enums.js";
import { OPEN_ENUMS } from "./meanings.js";
import { TOPICS } from "./schemas.js";

describe("meaning records", () => {
  for (const [enumName, record] of Object.entries(OPEN_ENUMS)) {
    test(`every ${enumName} name has a one-line meaning`, () => {
      // `battleMode` stays empty until its first fixture lands (amendment 015).
      if (enumName !== "battleMode") {
        expect(Object.keys(record).length).toBeGreaterThan(0);
      }
      for (const [value, entry] of Object.entries<{
        meaning: string;
        retiredIn?: string;
      }>(record)) {
        expect(value, enumName).toMatch(/^[a-z][a-z0-9_]*$/);
        expect(entry.meaning.trim(), `${enumName}.${value}`).not.toBe("");
        expect(entry.meaning, `${enumName}.${value}`).not.toContain("\n");
        if (entry.retiredIn !== undefined) {
          expect(entry.retiredIn, `${enumName}.${value}`).toMatch(
            /^\d+\.\d+\.\d+$/,
          );
        }
      }
    });
  }

  test("TOPICS lists the topic record's names in order", () => {
    expect<string[]>([...TOPICS]).toEqual(Object.keys(OPEN_ENUMS.topic));
  });
});

describe("append-only check", () => {
  const baseline: Baseline = {
    errorCode: {
      no_game: { meaning: "No ROM." },
      busy: { meaning: "Held.", retiredIn: "2.3.0" },
      old: { meaning: "Old." },
    },
    topic: { status: { meaning: "Status." } },
  };
  const same = () => structuredClone(baseline);

  test("passes when nothing changed", () => {
    expect(appendOnlyViolations(baseline, same())).toEqual([]);
  });

  test("passes when names are added, whole enums are added or retiredIn is newly set", () => {
    const next = same();
    next.errorCode ??= {};
    next.errorCode.fresh = { meaning: "New." };
    next.errorCode.old = { meaning: "Old.", retiredIn: "2.4.0" };
    next.bridgeId = { mgba: { meaning: "mGBA." } };
    expect(appendOnlyViolations(baseline, next)).toEqual([]);
  });

  test("fails when a name is removed", () => {
    const next = same();
    delete next.errorCode?.no_game;
    expect(appendOnlyViolations(baseline, next)).toEqual([
      "errorCode.no_game: removed or renamed",
    ]);
  });

  test("fails when a name is renamed", () => {
    const next = same();
    const { no_game, ...rest } = next.errorCode ?? {};
    next.errorCode = { ...rest, no_rom: no_game ?? { meaning: "" } };
    expect(appendOnlyViolations(baseline, next)).toEqual([
      "errorCode.no_game: removed or renamed",
    ]);
  });

  test("fails when a meaning changes", () => {
    const next = same();
    next.errorCode ??= {};
    next.errorCode.no_game = { meaning: "No ROM loaded." };
    expect(appendOnlyViolations(baseline, next)).toHaveLength(1);
  });

  test("fails when a set retiredIn changes or goes away", () => {
    const changed = same();
    changed.errorCode ??= {};
    changed.errorCode.busy = { meaning: "Held.", retiredIn: "2.5.0" };
    expect(appendOnlyViolations(baseline, changed)).toHaveLength(1);
    const unset = same();
    unset.errorCode ??= {};
    unset.errorCode.busy = { meaning: "Held." };
    expect(appendOnlyViolations(baseline, unset)).toHaveLength(1);
  });

  test("fails when a whole enum disappears", () => {
    const next = same();
    delete next.topic;
    expect(appendOnlyViolations(baseline, next)).toEqual([
      "topic: the whole enum is gone",
    ]);
  });
});

const baselineFile = Bun.file(BASELINE_FILE);
const hasBaseline = await baselineFile.exists();
if (!hasBaseline) {
  console.warn(
    "open-enums: api/open-enums.baseline.json doesn't exist, so the append-only check against the baseline is skipped. It appears in the api-v2.0.0 release commit (amendment 035 item 3).",
  );
}

describe("against the baseline", () => {
  test.skipIf(!hasBaseline)(
    "the records keep every baseline name and meaning",
    async () => {
      const baseline = (await baselineFile.json()) as Baseline;
      expect(appendOnlyViolations(baseline, currentBaseline())).toEqual([]);
    },
  );
});

describe("contract docs", () => {
  test("list exactly the open enums that have records", async () => {
    const docs = await Bun.file(DOCS_FILE).text();
    expect(documentedEnums(docs).sort()).toEqual(
      Object.keys(OPEN_ENUMS).sort(),
    );
  });

  test("render the current records", async () => {
    const docs = await Bun.file(DOCS_FILE).text();
    expect(
      recordsBlock(docs),
      "run `bun api/scripts/open-enums.ts docs` and commit docs/open-enums.md",
    ).toBe(renderRecords());
  });
});
