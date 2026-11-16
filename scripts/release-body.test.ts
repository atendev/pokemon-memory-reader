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
  EVIDENCE_FILE,
  readSignatureEvidence,
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

describe("the body step script", () => {
  const run = (...args: string[]) =>
    Bun.spawnSync(["bun", join(import.meta.dir, "release-body.ts"), ...args]);

  test("appends the notes to the body file", () => {
    const file = join(dir, "body.md");
    writeFileSync(file, "## v2.0.0-beta.1\n");
    expect(run(file).exitCode).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(
      `## v2.0.0-beta.1\n\n${readFileSync(EVIDENCE_FILE, "utf8").trimEnd()}\n`,
    );
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
