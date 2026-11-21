import { afterAll, describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  COVERAGE_FILE,
  EVIDENCE_FILE,
  readCoverageLists,
  readSignatureEvidence,
  withCoverageLists,
  withSignatureEvidence,
} from "./release-body";

const dir = mkdtempSync(join(tmpdir(), "release-body-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("readSignatureEvidence", () => {
  test("reads the committed notes file", () => {
    const text = readSignatureEvidence();
    expect(text).toBe(readFileSync(EVIDENCE_FILE, "utf8"));
    expect(text).toContain("emerald-us-1.0");
  });

  test("a missing file fails with the path and the fix", () => {
    const path = join(dir, "missing", "SIGNATURE-EVIDENCE.md");
    expect(() => readSignatureEvidence(path)).toThrow(
      `SIGNATURE-EVIDENCE.md is missing at ${path}. Run \`bun run generate:profiles\` and commit the result.`,
    );
  });

  test("a file without the heading fails", () => {
    mkdirSync(join(dir, "bad"));
    const path = join(dir, "bad", "SIGNATURE-EVIDENCE.md");
    writeFileSync(path, "");
    expect(() => readSignatureEvidence(path)).toThrow(
      "is empty or does not start with",
    );
  });
});

test("withSignatureEvidence puts the notes after the body", () => {
  expect(
    withSignatureEvidence("Body\n\n", "### Signature evidence\n\nx\n"),
  ).toBe("Body\n\n### Signature evidence\n\nx\n");
});

test("withSignatureEvidence refuses a body that already has the section", () => {
  const evidence = "### Signature evidence\n\nx\n";
  expect(() =>
    withSignatureEvidence(withSignatureEvidence("Body", evidence), evidence),
  ).toThrow("already has");
});

test("a file holding only the heading fails", () => {
  mkdirSync(join(dir, "stub"));
  const path = join(dir, "stub", "SIGNATURE-EVIDENCE.md");
  writeFileSync(path, "### Signature evidence\n");
  expect(() => readSignatureEvidence(path)).toThrow("is empty or");
});

const COVERAGE = `# Fixture coverage

## Support

x

## Profiles and primary revisions with no fixture

- crystal-us-1.1
- emerald-us-1.0

## Tier 2 gaps

- emerald-us-1.0/egg

## Failures

None.
`;

const writeCoverage = (name: string, text: string) => {
  mkdirSync(join(dir, name), { recursive: true });
  const path = join(dir, name, "coverage.md");
  writeFileSync(path, text);
  return path;
};

describe("readCoverageLists", () => {
  test("builds both lists from the committed guard output", () => {
    const text = readCoverageLists();
    const doc = readFileSync(COVERAGE_FILE, "utf8");
    expect(text.startsWith("### Fixture coverage")).toBe(true);
    expect(text).toContain("#### Tier 2 gaps");
    expect(text).toContain(
      "#### Profiles and primary revisions with no fixture",
    );
    for (const line of doc.split("\n").filter((l) => l.startsWith("- ")))
      expect(text).toContain(line);
    expect(text).not.toContain("Failures");
  });

  test("keeps the bullets of each list", () => {
    expect(readCoverageLists(writeCoverage("ok", COVERAGE))).toBe(
      [
        "### Fixture coverage",
        "",
        "#### Tier 2 gaps",
        "",
        "Fixtures the coverage guard lists as missing but does not require. Each is `<profile>/<state>`.",
        "",
        "- emerald-us-1.0/egg",
        "",
        "#### Profiles and primary revisions with no fixture",
        "",
        "Profiles, and primary revisions with no profile yet, whose fixture folder is empty.",
        "",
        "- crystal-us-1.1",
        "- emerald-us-1.0",
        "",
      ].join("\n"),
    );
  });

  test("an empty list reads None.", () => {
    const text = readCoverageLists(
      writeCoverage("none", COVERAGE.replace("- emerald-us-1.0/egg", "None.")),
    );
    expect(text).toContain("empty.\n\n- crystal-us-1.1");
    expect(text).toMatch(/Each is `<profile>\/<state>`\.\n\nNone\.\n/);
  });

  test("a missing file fails with the path and the fix", () => {
    const path = join(dir, "gone", "coverage.md");
    expect(() => readCoverageLists(path)).toThrow(
      `coverage.md is missing at ${path}. Run \`bun run coverage\` and commit the result.`,
    );
  });

  test("a file that is not the coverage page fails", () => {
    const path = writeCoverage("alien", "hello\n");
    expect(() => readCoverageLists(path)).toThrow(
      'does not start with "# Fixture coverage"',
    );
  });

  test("a missing list fails and names the section", () => {
    const path = writeCoverage(
      "nolist",
      COVERAGE.replace("## Tier 2 gaps", "## Something else"),
    );
    expect(() => readCoverageLists(path)).toThrow(
      'no "## Tier 2 gaps" section',
    );
  });

  test("an empty section fails", () => {
    const path = writeCoverage(
      "emptysec",
      COVERAGE.replace("- emerald-us-1.0/egg\n", ""),
    );
    expect(() => readCoverageLists(path)).toThrow(
      'no "## Tier 2 gaps" section',
    );
  });

  test("a section with text that is not a bullet list is damaged", () => {
    const path = writeCoverage(
      "damaged",
      COVERAGE.replace("- emerald-us-1.0/egg", "emerald-us-1.0/egg"),
    );
    expect(() => readCoverageLists(path)).toThrow(
      'damaged "## Tier 2 gaps" section',
    );
  });

  test("a list that is the last section still reads", () => {
    const path = writeCoverage(
      "last",
      COVERAGE.replace("\n## Failures\n\nNone.\n", ""),
    );
    expect(readCoverageLists(path)).toContain("- emerald-us-1.0/egg");
  });
});

test("withCoverageLists puts the section after the body", () => {
  expect(withCoverageLists("Body\n\n", "### Fixture coverage\n\nx\n")).toBe(
    "Body\n\n### Fixture coverage\n\nx\n",
  );
});

test("withCoverageLists refuses a body that already has the section", () => {
  const section = "### Fixture coverage\n\nx\n";
  expect(() =>
    withCoverageLists(withCoverageLists("Body", section), section),
  ).toThrow("already has");
});

describe("the body step script", () => {
  const run = (...args: string[]) =>
    Bun.spawnSync(["bun", join(import.meta.dir, "release-body.ts"), ...args]);

  test("appends the notes to the body file", () => {
    const file = join(dir, "body.md");
    writeFileSync(file, "## v2.0.0-beta.1\n");
    expect(run(file).exitCode).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(
      `## v2.0.0-beta.1\n\n${readFileSync(EVIDENCE_FILE, "utf8").trimEnd()}\n\n${readCoverageLists().trimEnd()}\n`,
    );
  });

  test("a missing or damaged guard output fails the step and leaves the body alone", () => {
    const file = join(dir, "guard.md");
    writeFileSync(file, "Body\n");
    const missing = run(file, EVIDENCE_FILE, join(dir, "nope", "coverage.md"));
    expect(missing.exitCode).toBe(1);
    expect(missing.stderr.toString()).toContain("coverage.md is missing");
    const damaged = run(
      file,
      EVIDENCE_FILE,
      writeCoverage("cli-damaged", "# Fixture coverage\n"),
    );
    expect(damaged.exitCode).toBe(1);
    expect(damaged.stderr.toString()).toContain('no "## Tier 2 gaps" section');
    expect(readFileSync(file, "utf8")).toBe("Body\n");
  });

  test("a missing notes file fails the step and leaves the body alone", () => {
    const file = join(dir, "untouched.md");
    writeFileSync(file, "Body\n");
    const result = run(file, join(dir, "nope.md"));
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(
      "SIGNATURE-EVIDENCE.md is missing",
    );
    expect(readFileSync(file, "utf8")).toBe("Body\n");
  });

  test("a missing body file fails the step", () => {
    const result = run(join(dir, "no-body.md"));
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("no-body.md");
  });

  test("a second run on the same body fails and leaves it as it was", () => {
    const file = join(dir, "twice.md");
    writeFileSync(file, "Body\n");
    expect(run(file).exitCode).toBe(0);
    const once = readFileSync(file, "utf8");
    expect(run(file).exitCode).toBe(1);
    expect(readFileSync(file, "utf8")).toBe(once);
  });

  test("exits 2 with usage when given no file", () => {
    const result = run();
    expect(result.exitCode).toBe(2);
    expect(result.stderr.toString()).toContain("Usage:");
  });
});
