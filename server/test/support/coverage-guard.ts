import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { isSupported, type SupportFlags } from "../../src/format/support";
import { DATA_FORMATS, type DataFormatId } from "../../src/profile/schema";
import {
  PRIMARY_REVISIONS,
  type RequiredState,
  requiredFor,
  SMOKE_STATES,
} from "../fixtures/coverage";

/** What the fixture folder holds for one state of one profile. */
export interface FoundState {
  readonly fixture: boolean;
  readonly golden: boolean;
  readonly draft: boolean;
  /** The golden's `verified` list, or null when there is no golden or it can't be read. */
  readonly verified: readonly string[] | null;
  /** Why the golden couldn't be read. */
  readonly goldenProblem: string | null;
}

/** `<profile-id>` to `<slug>` to what was found. */
export type FixtureIndex = ReadonlyMap<string, ReadonlyMap<string, FoundState>>;

export interface ProfileInfo {
  readonly id: string;
  readonly dataFormat: string;
  readonly fixture: "full" | "smoke" | "none";
}

const SUFFIXES = [
  [".expected.draft.json", "draft"],
  [".expected.json", "golden"],
  [".fixture.json", "fixture"],
] as const;

/** Reads `<root>/<profile-id>/*.json`. A missing root is an empty index. */
export async function scanFixtures(root: string): Promise<FixtureIndex> {
  const index = new Map<string, Map<string, FoundState>>();
  let dirs: string[];
  try {
    dirs = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return index;
  }
  for (const dir of dirs.sort()) {
    const states = new Map<string, FoundState>();
    for (const file of (await readdir(join(root, dir))).sort()) {
      const kind = SUFFIXES.find(([suffix]) => file.endsWith(suffix));
      if (kind === undefined) continue;
      const slug = file.slice(0, file.length - kind[0].length);
      const prior = states.get(slug) ?? {
        fixture: false,
        golden: false,
        draft: false,
        verified: null,
        goldenProblem: null,
      };
      let next: FoundState = { ...prior, [kind[1]]: true };
      if (kind[1] === "golden") {
        try {
          const json = JSON.parse(await Bun.file(join(root, dir, file)).text());
          const verified: unknown = json?.verified;
          if (
            !Array.isArray(verified) ||
            verified.some((v) => typeof v !== "string")
          )
            throw new Error("`verified` isn't a list of strings");
          next = { ...next, verified: verified as string[] };
        } catch (error) {
          next = { ...next, goldenProblem: (error as Error).message };
        }
      }
      states.set(slug, next);
    }
    index.set(dir, states);
  }
  return index;
}

export interface CoverageInputs {
  readonly index: FixtureIndex;
  readonly profiles: readonly ProfileInfo[];
  readonly support: SupportFlags;
  /** Defaults to the committed matrix. Tests pass a smaller one. */
  readonly primary?: Readonly<Record<DataFormatId, readonly string[]>>;
  readonly required?: (
    format: DataFormatId,
    tier?: 1 | 2,
  ) => readonly RequiredState[];
}

export interface CoverageReport {
  /** Each one fails the suite. Sorted. */
  readonly failures: readonly string[];
  /** `<profile-id>/<slug>` for each tier 2 state a primary revision lacks. Never fails the suite. Sorted. */
  readonly tier2Gaps: readonly string[];
  /** Profiles, and primary revisions with no profile yet, whose fixture folder is empty. Sorted. */
  readonly noFixture: readonly string[];
}

/** A fixture and its golden are both there. */
export function hasState(
  index: FixtureIndex,
  id: string,
  slug: string,
): boolean {
  const found = index.get(id)?.get(slug);
  return found?.fixture === true && found.golden;
}

const isFormat = (value: string): value is DataFormatId =>
  (DATA_FORMATS as readonly string[]).includes(value);

/** The guard and the support gate (spec §12.8). */
export function checkCoverage(inputs: CoverageInputs): CoverageReport {
  const primary = inputs.primary ?? PRIMARY_REVISIONS;
  const required = inputs.required ?? requiredFor;
  const failures: string[] = [];
  const tier2Gaps: string[] = [];
  const profileById = new Map(inputs.profiles.map((p) => [p.id, p]));
  const primaryFormat = new Map<string, DataFormatId>();
  for (const format of DATA_FORMATS)
    for (const id of primary[format]) primaryFormat.set(id, format);

  const formatOf = (id: string): DataFormatId | null => {
    const known = profileById.get(id)?.dataFormat;
    if (known !== undefined) return isFormat(known) ? known : null;
    return primaryFormat.get(id) ?? null;
  };

  const verifiedGaps = (id: string, state: RequiredState): string[] => {
    const found = inputs.index.get(id)?.get(state.slug);
    if (found?.verified == null) return [];
    const have = new Set(found.verified);
    return state.verifies
      .filter((field) => !have.has(field))
      .map(
        (field) =>
          `${id}/${state.slug}: the golden's verified list lacks ${field}`,
      );
  };

  for (const [id, states] of inputs.index) {
    const format = formatOf(id);
    if (format === null)
      failures.push(`${id}: no profile or primary revision has this id`);
    for (const [slug, found] of states) {
      if (found.draft)
        failures.push(
          `${id}/${slug}: a draft golden is committed, and only the owner promotes it`,
        );
      if (found.fixture && !found.golden)
        failures.push(`${id}/${slug}: the fixture has no golden`);
      if (found.golden && !found.fixture)
        failures.push(`${id}/${slug}: the golden has no fixture`);
      if (found.goldenProblem !== null)
        failures.push(
          `${id}/${slug}: the golden is unreadable (${found.goldenProblem})`,
        );
    }
    if (format === null) continue;
    for (const state of required(format, 1))
      failures.push(...verifiedGaps(id, state));
  }

  const has = (id: string, slug: string) => hasState(inputs.index, id, slug);
  const missing = (id: string, format: DataFormatId, tier: 1 | 2) =>
    required(format, tier).filter((state) => !has(id, state.slug));

  for (const format of DATA_FORMATS) {
    for (const id of primary[format]) {
      for (const state of missing(id, format, 2))
        tier2Gaps.push(`${id}/${state.slug}`);
      if (!isSupported(inputs.support, format)) continue;
      for (const state of missing(id, format, 1))
        failures.push(
          `${id}/${state.slug}: ${format} is supported, so every primary revision needs this tier 1 fixture`,
        );
    }
  }

  for (const profile of inputs.profiles) {
    const folder = inputs.index.get(profile.id);
    const present = folder?.size ?? 0;
    const format = formatOf(profile.id);
    if (profile.fixture === "none" && present > 0)
      failures.push(
        `${profile.id}: the profile says fixture "none" but has a fixture folder`,
      );
    if (profile.fixture === "smoke")
      for (const slug of SMOKE_STATES)
        if (!has(profile.id, slug))
          failures.push(
            `${profile.id}/${slug}: the profile says fixture "smoke" but lacks this smoke fixture`,
          );
    if (profile.fixture === "full" && format !== null)
      for (const state of missing(profile.id, format, 1))
        failures.push(
          `${profile.id}/${state.slug}: the profile says fixture "full" but lacks this tier 1 fixture`,
        );
  }

  const noFixture = [
    ...inputs.profiles.map((p) => p.id),
    ...[...primaryFormat.keys()].filter((id) => !profileById.has(id)),
  ].filter((id) => (inputs.index.get(id)?.size ?? 0) === 0);

  const sorted = (list: string[]) => [...new Set(list)].sort();
  return {
    failures: sorted(failures),
    tier2Gaps: sorted(tier2Gaps),
    noFixture: sorted(noFixture),
  };
}

/** The headings of the two lists `docs/coverage.md` ends with. The draft release body (`scripts/release-body.ts`) reads them by these names. */
export const NO_FIXTURE_HEADING =
  "Profiles and primary revisions with no fixture";
export const TIER2_GAPS_HEADING = "Tier 2 gaps";

const cell = (text: string) => text.replaceAll("|", "\\|");
const code = (items: readonly string[]) =>
  items.length === 0 ? "none" : items.map((item) => `\`${item}\``).join(", ");

/** The coverage page, generated from the matrix, the support flags, the profiles and the fixture folders. */
export function renderCoverage(
  inputs: CoverageInputs & {
    states: readonly RequiredState[];
  },
): string {
  const primary = inputs.primary ?? PRIMARY_REVISIONS;
  const report = checkCoverage(inputs);
  const has = (id: string, slug: string) => hasState(inputs.index, id, slug);
  const required = inputs.required ?? requiredFor;
  const lines: string[] = [
    "# Fixture coverage",
    "",
    "Generated by `bun run coverage`. Don't edit it. A test in the default suite fails when it is stale (spec §12.7, §12.8).",
    "",
    "## Support",
    "",
    "A data format's `supported` flag may be true only when every primary revision has every tier 1 fixture with its fields verified. An unsupported format's resources answer `503 unsupported`.",
    "",
    "| Data format | Supported | Primary revisions | Tier 1 present |",
    "| --- | --- | --- | --- |",
  ];
  for (const format of DATA_FORMATS) {
    const tier1 = required(format, 1);
    const revisions = primary[format]
      .map(
        (id) =>
          `${id} ${tier1.filter((s) => has(id, s.slug)).length}/${tier1.length}`,
      )
      .join(", ");
    lines.push(
      `| ${format} | ${isSupported(inputs.support, format) ? "yes" : "no"} | ${primary[format].join(", ")} | ${revisions} |`,
    );
  }
  lines.push(
    "",
    "## Required states",
    "",
    "Tier 1 states must exist for every primary revision of a supported format. Tier 2 gaps never fail the suite. Field names are paths into the golden's `resources`.",
    "",
    "| Slug | Tier | State | Data formats | Proves | Fields to verify |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const state of inputs.states)
    lines.push(
      `| \`${state.slug}\` | ${state.tier} | ${cell(state.state)} | ${state.formats?.join(", ") ?? "all"} | ${cell(state.proves ?? "")} | ${code(state.verifies)} |`,
    );
  lines.push(
    "",
    "## Profile coverage",
    "",
    "| Profile | Data format | Fixture | Fixtures found |",
    "| --- | --- | --- | --- |",
  );
  for (const profile of [...inputs.profiles].sort((a, b) =>
    a.id.localeCompare(b.id),
  ))
    lines.push(
      `| ${profile.id} | ${profile.dataFormat} | ${profile.fixture} | ${inputs.index.get(profile.id)?.size ?? 0} |`,
    );
  const list = (title: string, items: readonly string[]) =>
    lines.push(
      "",
      `## ${title}`,
      "",
      ...(items.length === 0 ? ["None."] : items.map((item) => `- ${item}`)),
    );
  list(NO_FIXTURE_HEADING, report.noFixture);
  list(TIER2_GAPS_HEADING, report.tier2Gaps);
  list("Failures", report.failures);
  return `${lines.join("\n")}\n`;
}
