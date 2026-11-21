import { OPEN_ENUMS } from "../src/meanings.js";

/** Every open enum's names, meaning texts and `retiredIn` values (amendment 035 item 7). */
export type Baseline = Record<
  string,
  Record<string, { meaning: string; retiredIn?: string }>
>;

export const BASELINE_FILE = new URL(
  "../open-enums.baseline.json",
  import.meta.url,
);
export const DOCS_FILE = new URL("../../docs/open-enums.md", import.meta.url);

const START = "<!-- open-enums:start -->";
const END = "<!-- open-enums:end -->";

/** The current records as a baseline, with `retiredIn` kept only where it is set. */
export function currentBaseline(): Baseline {
  const out: Baseline = {};
  for (const [name, record] of Object.entries(OPEN_ENUMS)) {
    out[name] = {};
    for (const [value, entry] of Object.entries<{
      meaning: string;
      retiredIn?: string;
    }>(record)) {
      out[name][value] = {
        meaning: entry.meaning,
        ...(entry.retiredIn === undefined
          ? {}
          : { retiredIn: entry.retiredIn }),
      };
    }
  }
  return out;
}

export function serializeBaseline(baseline: Baseline): string {
  return `${JSON.stringify(baseline, null, 2)}\n`;
}

/**
 * The append-only check (amendment 035 item 7). A subset comparison: every baseline enum and name
 * must still exist with the same meaning text, and a `retiredIn` set in the baseline must not
 * change. New names pass, and so does setting `retiredIn` where the baseline has none.
 * It cannot catch a baseline file rewritten to match a bad edit, so review guards that file.
 */
export function appendOnlyViolations(
  baseline: Baseline,
  current: Baseline,
): string[] {
  const problems: string[] = [];
  for (const [enumName, names] of Object.entries(baseline)) {
    const now = current[enumName];
    if (now === undefined) {
      problems.push(`${enumName}: the whole enum is gone`);
      continue;
    }
    for (const [value, was] of Object.entries(names)) {
      const entry = now[value];
      if (entry === undefined) {
        problems.push(`${enumName}.${value}: removed or renamed`);
        continue;
      }
      if (entry.meaning !== was.meaning) {
        problems.push(
          `${enumName}.${value}: meaning changed from ${JSON.stringify(was.meaning)} to ${JSON.stringify(entry.meaning)}`,
        );
      }
      if (was.retiredIn !== undefined && entry.retiredIn !== was.retiredIn) {
        problems.push(
          `${enumName}.${value}: retiredIn changed from ${was.retiredIn} to ${entry.retiredIn ?? "unset"}`,
        );
      }
    }
  }
  return problems;
}

/** The records as bullet lists, the part of the contract docs between the two markers. */
export function renderRecords(baseline: Baseline = currentBaseline()): string {
  const sections = Object.entries(baseline).map(([name, names]) => {
    const rows = Object.entries(names).map(
      ([value, entry]) =>
        `- \`${value}\`: ${entry.meaning}${entry.retiredIn === undefined ? "" : ` Retired in ${entry.retiredIn}.`}`,
    );
    return [
      `### \`${name}\``,
      "",
      ...(rows.length === 0 ? ["No name is emitted yet."] : rows),
    ].join("\n");
  });
  return `${START}\n\n${sections.join("\n\n")}\n\n${END}`;
}

/** The generated block of a docs file, markers included, or null when a marker is missing. */
export function recordsBlock(docs: string): string | null {
  const start = docs.indexOf(START);
  const end = docs.indexOf(END);
  if (start === -1 || end === -1 || end < start) return null;
  return docs.slice(start, end + END.length);
}

/** The enum names the docs list by hand, one backticked name per bullet under "The open enums". */
export function documentedEnums(docs: string): string[] {
  const section = docs
    .split(/^## /m)
    .find((s) => s.startsWith("The open enums"));
  if (section === undefined) return [];
  return [...section.matchAll(/^- `(\w+)`/gm)].flatMap((m) =>
    m[1] === undefined ? [] : [m[1]],
  );
}

if (import.meta.main) {
  const command = process.argv[2];
  if (command === "baseline") {
    await Bun.write(BASELINE_FILE, serializeBaseline(currentBaseline()));
    console.log("Wrote api/open-enums.baseline.json");
  } else if (command === "docs") {
    const docs = await Bun.file(DOCS_FILE).text();
    const block = recordsBlock(docs);
    if (block === null) throw new Error("docs/open-enums.md lost its markers");
    await Bun.write(
      DOCS_FILE,
      docs.replace(block, () => renderRecords()),
    );
    console.log("Rewrote the records in docs/open-enums.md");
  } else {
    console.error("Usage: bun api/scripts/open-enums.ts baseline | docs");
    process.exit(2);
  }
}
