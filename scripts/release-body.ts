import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  NO_FIXTURE_HEADING,
  TIER2_GAPS_HEADING,
} from "../server/test/support/coverage-guard";

/** The generator's notes file, copied into every draft release body (spec §13.7, 022 amendment). */
export const EVIDENCE_FILE = join(
  import.meta.dir,
  "../server/src/profile/builtin/SIGNATURE-EVIDENCE.md",
);
const HEADING = "### Signature evidence";

/** The coverage guard's committed output, whose two lists go into every draft release body (spec §12.8). */
export const COVERAGE_FILE = join(import.meta.dir, "../docs/coverage.md");
const COVERAGE_BODY_HEADING = "### Fixture coverage";

/** Returns the notes text, or throws a message that says how to regenerate a missing or damaged file. */
export function readSignatureEvidence(path: string = EVIDENCE_FILE): string {
  const fix = "Run `bun run generate:profiles` and commit the result.";
  if (!existsSync(path)) {
    throw new Error(`SIGNATURE-EVIDENCE.md is missing at ${path}. ${fix}`);
  }
  const text = readFileSync(path, "utf8");
  if (!text.startsWith(HEADING) || text.slice(HEADING.length).trim() === "") {
    throw new Error(
      `SIGNATURE-EVIDENCE.md at ${path} is empty or does not start with "${HEADING}". ${fix}`,
    );
  }
  return text;
}

/** Adds the evidence notes after the body, separated by one blank line. A second run fails instead of doubling the section. */
export function withSignatureEvidence(body: string, evidence: string): string {
  if (body.includes(HEADING)) {
    throw new Error(`The release body already has a "${HEADING}" section.`);
  }
  return `${body.trimEnd()}\n\n${evidence.trimEnd()}\n`;
}

/** The lines under a `## <title>` heading of the coverage page, up to the next heading. Null when the heading is absent. */
function sectionLines(text: string, title: string): string[] | null {
  const lines = text.split("\n");
  const start = lines.indexOf(`## ${title}`);
  if (start === -1) return null;
  const end = lines.findIndex((line, i) => i > start && line.startsWith("#"));
  return lines.slice(start + 1, end === -1 ? undefined : end);
}

/** One list from the coverage page: its bullets, or none for `None.`. Throws when the section is absent or holds anything else. */
function guardList(text: string, title: string, path: string): string[] {
  const fix = "Run `bun run coverage` and commit the result.";
  const lines = sectionLines(text, title)?.filter((line) => line.trim() !== "");
  if (lines === undefined || lines.length === 0) {
    throw new Error(
      `coverage.md at ${path} has no "## ${title}" section. ${fix}`,
    );
  }
  if (lines.length === 1 && lines[0] === "None.") return [];
  if (!lines.every((line) => line.startsWith("- ") && line.length > 2)) {
    throw new Error(
      `coverage.md at ${path} has a damaged "## ${title}" section: it must be "None." or a bullet list. ${fix}`,
    );
  }
  return lines;
}

/** Returns the release body's coverage section, built from the guard's tier 2 gaps and no-fixture lists. Throws on a missing or damaged file. */
export function readCoverageLists(path: string = COVERAGE_FILE): string {
  if (!existsSync(path)) {
    throw new Error(
      `coverage.md is missing at ${path}. Run \`bun run coverage\` and commit the result.`,
    );
  }
  const text = readFileSync(path, "utf8");
  if (!text.startsWith("# Fixture coverage")) {
    throw new Error(
      `coverage.md at ${path} does not start with "# Fixture coverage". Run \`bun run coverage\` and commit the result.`,
    );
  }
  const part = (title: string, intro: string) => {
    const items = guardList(text, title, path);
    return [
      `#### ${title}`,
      "",
      intro,
      "",
      ...(items.length === 0 ? ["None."] : items),
    ].join("\n");
  };
  return [
    COVERAGE_BODY_HEADING,
    "",
    part(
      TIER2_GAPS_HEADING,
      "Fixtures the coverage guard lists as missing but does not require. Each is `<profile>/<state>`.",
    ),
    "",
    part(
      NO_FIXTURE_HEADING,
      "Profiles, and primary revisions with no profile yet, whose fixture folder is empty.",
    ),
    "",
  ].join("\n");
}

/** Adds the coverage lists after the body, separated by one blank line. A second run fails instead of doubling the section. */
export function withCoverageLists(body: string, coverage: string): string {
  if (body.includes(COVERAGE_BODY_HEADING)) {
    throw new Error(
      `The release body already has a "${COVERAGE_BODY_HEADING}" section.`,
    );
  }
  return `${body.trimEnd()}\n\n${coverage.trimEnd()}\n`;
}

// `release.yml`'s body step runs this on the file it passes to `gh release create --notes-file`.
if (import.meta.main) {
  const [bodyFile, evidenceFile, coverageFile] = process.argv.slice(2);
  if (!bodyFile) {
    console.error(
      "Usage: bun scripts/release-body.ts <release-body-file> [evidence-file] [coverage-file]",
    );
    process.exit(2);
  }
  try {
    // Read and check everything before the first write, so a failure leaves the body as it was.
    const evidence = readSignatureEvidence(evidenceFile);
    const coverage = readCoverageLists(coverageFile);
    const body = withSignatureEvidence(
      readFileSync(bodyFile, "utf8"),
      evidence,
    );
    writeFileSync(bodyFile, withCoverageLists(body, coverage));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
