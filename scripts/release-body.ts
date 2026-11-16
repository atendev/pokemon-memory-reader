import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The generator's notes file, copied into every draft release body (spec §13.7, 022 amendment). */
export const EVIDENCE_FILE = join(
  import.meta.dir,
  "../server/src/profile/builtin/SIGNATURE-EVIDENCE.md",
);
const HEADING = "### Signature evidence";

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

// `release.yml`'s body step runs this on the file it passes to `gh release create --notes-file`.
if (import.meta.main) {
  const [bodyFile, evidenceFile] = process.argv.slice(2);
  if (!bodyFile) {
    console.error(
      "Usage: bun scripts/release-body.ts <release-body-file> [evidence-file]",
    );
    process.exit(2);
  }
  try {
    const evidence = readSignatureEvidence(evidenceFile);
    writeFileSync(
      bodyFile,
      withSignatureEvidence(readFileSync(bodyFile, "utf8"), evidence),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
