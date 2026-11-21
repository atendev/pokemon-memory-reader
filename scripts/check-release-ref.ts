import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

/**
 * The one branch besides main that a prerelease tag may be reachable from (amendment 024 item 1). The final release
 * ticket deletes this constant before main moves. Set, it also makes every stable tag fail (item 3).
 */
export const PRERELEASE_BRANCH: string | null = "wayfinder/v2-build-master";

export type ReleaseKind = "app" | "api";

/** Where each kind keeps the version its tag has to match (amendment 024 item 2). */
export const PACKAGE_FILE: Record<ReleaseKind, string> = {
  app: "server/package.json",
  api: "api/package.json",
};
export const CHANGELOG_FILE: Record<ReleaseKind, string> = {
  app: "CHANGELOG.md",
  api: "api/CHANGELOG.md",
};
const TAG_PREFIX: Record<ReleaseKind, string> = { app: "v", api: "api-v" };

const IDENT = "(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)";
const SEMVER = new RegExp(
  `^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-(${IDENT}(?:\\.${IDENT})*))?$`,
);

export interface ParsedTag {
  version: string;
  /** True exactly when the version has a `-` (spec §13.6). */
  prerelease: boolean;
}

/** Reads `v<semver>` or `api-v<semver>`. Returns a reason when the tag isn't one. Build metadata isn't accepted. */
export function parseTag(tag: string, kind: ReleaseKind): ParsedTag | string {
  const prefix = TAG_PREFIX[kind];
  if (!tag.startsWith(prefix)) {
    return `The tag ${tag} doesn't start with ${prefix}, so it isn't a ${kind} release tag.`;
  }
  const version = tag.slice(prefix.length);
  if (!SEMVER.test(version)) {
    return `The tag ${tag} doesn't parse as semver (${prefix}<major>.<minor>.<patch>[-<prerelease>]).`;
  }
  return { version, prerelease: version.includes("-") };
}

export interface RefFacts {
  tag: string;
  kind: ReleaseKind;
  /** The `version` in the kind's package.json at the tagged commit. */
  packageVersion: string;
  /** Whether the tagged commit is an ancestor of `origin/main`. */
  onMain: boolean;
  /** Whether `origin/<prereleaseBranch>` exists. Ignored when `prereleaseBranch` is null. */
  branchExists: boolean;
  /** Whether the tagged commit is an ancestor of `origin/<prereleaseBranch>`. */
  onBranch: boolean;
  /** The value of `PRERELEASE_BRANCH`, passed in so tests can try it both set and empty. */
  prereleaseBranch: string | null;
}

/** The rule table of amendment 024 items 1 to 3. Returns one message per broken rule, empty when the tag may ship. */
export function checkRef(facts: RefFacts): string[] {
  const parsed = parseTag(facts.tag, facts.kind);
  if (typeof parsed === "string") return [parsed];
  const problems: string[] = [];
  const file = PACKAGE_FILE[facts.kind];
  if (parsed.version !== facts.packageVersion) {
    problems.push(
      `The tag ${facts.tag} says ${parsed.version} but ${file} says ${facts.packageVersion}.`,
    );
  }
  const branch = facts.prereleaseBranch;
  if (!parsed.prerelease) {
    if (branch !== null) {
      problems.push(
        `The tag ${facts.tag} is a stable release, and PRERELEASE_BRANCH in scripts/check-release-ref.ts is still set to ${branch}. Delete the constant before a stable tag.`,
      );
    }
    if (!facts.onMain) {
      problems.push(
        `The tag ${facts.tag} is a stable release, so its commit has to be reachable from origin/main, and it isn't.`,
      );
    }
    return problems;
  }
  if (branch !== null && !facts.branchExists) {
    problems.push(
      `PRERELEASE_BRANCH names ${branch}, which doesn't exist on origin. The check doesn't fall back to skipping it.`,
    );
  }
  const onAllowedBranch =
    branch !== null && facts.branchExists && facts.onBranch;
  if (!facts.onMain && !onAllowedBranch) {
    problems.push(
      branch === null
        ? `The tag ${facts.tag} is a prerelease, so its commit has to be reachable from origin/main, and it isn't.`
        : `The tag ${facts.tag} is a prerelease, so its commit has to be reachable from origin/main or origin/${branch}, and it is neither.`,
    );
  }
  return problems;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Finds links into this repo's tree or blob views that aren't pinned to the tag being released (amendment 024 item 6).
 * Main shows v1 until v2.0.0, and a stale tag from an earlier rc would show old files.
 */
export function lintBodyLinks(
  body: string,
  repo: string,
  tag: string,
): string[] {
  const pattern = new RegExp(
    `https://github\\.com/${escapeRegExp(repo)}/(?:blob|tree)/([^/\\s)>\\]"']+)/`,
    "gi",
  );
  const problems: string[] = [];
  for (const match of body.matchAll(pattern)) {
    if (match[1] !== tag) {
      problems.push(
        `The release body links to ${match[0]}, which isn't pinned to the tag ${tag}. Use blob/${tag}/ or tree/${tag}/.`,
      );
    }
  }
  return [...new Set(problems)];
}

/** Returns the text under the changelog heading for `version`, or null. Accepts `## 1.2.3`, `## [1.2.3]` and a trailing date. */
export function changelogSection(
  changelog: string,
  version: string,
): string | null {
  const lines = changelog.split(/\r?\n/);
  const heading = new RegExp(
    `^##\\s+\\[?v?${escapeRegExp(version)}\\]?(?:\\s|$)`,
  );
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  const section = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
  return section === "" ? null : section;
}

export interface BodyInput {
  tag: string;
  kind: ReleaseKind;
  repo: string;
  changelog: string | null;
  notes: string;
  /** A dry run has no changelog section to find, so it gets a placeholder instead of an error. */
  dryRun: boolean;
}

/** Builds the release body from the changelog section and the user notes, and lints its links. Throws on a problem. */
export function buildBody(input: BodyInput): string {
  const parsed = parseTag(input.tag, input.kind);
  if (typeof parsed === "string") throw new Error(parsed);
  const section =
    input.changelog === null
      ? null
      : changelogSection(input.changelog, parsed.version);
  let main = section;
  if (main === null) {
    if (!input.dryRun) {
      throw new Error(
        `${CHANGELOG_FILE[input.kind]} has no section for ${parsed.version}. Write it on the branch before tagging.`,
      );
    }
    main = `Dry run build of ${input.tag}. ${CHANGELOG_FILE[input.kind]} has no section for ${parsed.version} yet.`;
  }
  const body = `${main.trimEnd()}\n\n${input.notes.trim()}\n`;
  const problems = lintBodyLinks(body, input.repo, input.tag);
  if (problems.length > 0) throw new Error(problems.join("\n"));
  return body;
}

// --- Command line ---

function git(args: string[]): { ok: boolean; out: string } {
  const result = spawnSync("git", args, { encoding: "utf8" });
  return { ok: result.status === 0, out: (result.stdout ?? "").trim() };
}

function isAncestor(ref: string): boolean {
  return git(["merge-base", "--is-ancestor", "HEAD", ref]).ok;
}

const USAGE = `Usage:
  bun scripts/check-release-ref.ts check --tag <tag> [--kind app|api] [--dry-run] [--output <file>]
  bun scripts/check-release-ref.ts body --tag <tag> --repo <owner/name> --out <file> [--kind app|api] [--notes <file>] [--dry-run]`;

function option(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

function readKind(args: string[]): ReleaseKind | undefined {
  const kind = option(args, "--kind") ?? "app";
  return kind === "app" || kind === "api" ? kind : undefined;
}

export function main(args: string[]): number {
  const [command, ...rest] = args;
  const tag = option(rest, "--tag");
  const kind = readKind(rest);
  const dryRun = rest.includes("--dry-run");
  if (!tag || !kind) {
    console.error(USAGE);
    return 2;
  }
  try {
    if (command === "check") {
      const parsed = parseTag(tag, kind);
      if (typeof parsed === "string") {
        console.error(`error: ${parsed}`);
        return 1;
      }
      const packageFile = PACKAGE_FILE[kind];
      const packageVersion = (
        JSON.parse(readFileSync(packageFile, "utf8")) as { version: string }
      ).version;
      let problems: string[];
      if (dryRun) {
        // A dry run has no tag, so there's no tagged commit to test. The git facts pass and the other rules still apply.
        problems = checkRef({
          tag,
          kind,
          packageVersion,
          onMain: true,
          branchExists: true,
          onBranch: true,
          prereleaseBranch: PRERELEASE_BRANCH,
        });
        console.log("Dry run: reachability from origin/main isn't checked.");
      } else {
        const branch = PRERELEASE_BRANCH;
        problems = checkRef({
          tag,
          kind,
          packageVersion,
          onMain: isAncestor("origin/main"),
          branchExists:
            branch !== null &&
            git([
              "rev-parse",
              "--verify",
              "--quiet",
              `refs/remotes/origin/${branch}`,
            ]).ok,
          onBranch: branch !== null && isAncestor(`origin/${branch}`),
          prereleaseBranch: branch,
        });
      }
      for (const p of problems) console.error(`error: ${p}`);
      if (problems.length > 0) return 1;
      const output = option(rest, "--output");
      if (output) {
        appendFileSync(
          output,
          `version=${parsed.version}\nprerelease=${parsed.prerelease}\n`,
        );
      }
      console.log(`Release ref check passed for ${tag}.`);
      return 0;
    }
    if (command === "body") {
      const repo = option(rest, "--repo");
      const out = option(rest, "--out");
      if (!repo || !out) {
        console.error(USAGE);
        return 2;
      }
      const notesFile = option(rest, "--notes") ?? "scripts/release-notes.md";
      const changelogFile = CHANGELOG_FILE[kind];
      writeFileSync(
        out,
        buildBody({
          tag,
          kind,
          repo,
          changelog: existsSync(changelogFile)
            ? readFileSync(changelogFile, "utf8")
            : null,
          notes: readFileSync(notesFile, "utf8"),
          dryRun,
        }),
      );
      return 0;
    }
  } catch (error) {
    console.error(
      `error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
  console.error(USAGE);
  return 2;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
