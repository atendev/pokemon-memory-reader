import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import parseSpdx from "spdx-expression-parse";

// Loaded with `require` because the parser loads the same files that way, and Bun hands it a namespace object when they were imported as ES modules first.
const require = createRequire(import.meta.url);
const licenseIds: string[] = require("spdx-license-ids");
const deprecatedLicenseIds: string[] = require("spdx-license-ids/deprecated");
const exceptionIds: string[] = require("spdx-exceptions");
const deprecatedExceptionIds: string[] = require("spdx-exceptions/deprecated");

/** Accepted for every entry: npm packages, Bun runtime components and bundled assets (amendments 027 item 1 and 043 item 1). */
export const PERMISSIVE_TIER: readonly string[] = [
  "MIT",
  "ISC",
  "0BSD",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "Zlib",
  "Unicode-3.0",
  "Unlicense",
  "CC0-1.0",
  "MIT-0",
  "BSL-1.0",
  "Unicode-DFS-2016",
];

/** Accepted only for entries in the Bun runtime manifest: the permissive tier plus what Bun's binary needs. */
export const RUNTIME_TIER: readonly string[] = [
  ...PERMISSIVE_TIER,
  "LGPL-2.0-or-later",
  "LGPL-2.1-or-later",
  "MPL-2.0",
  "IJG",
  "blessing",
  "LicenseRef-PublicDomain",
];

/** Exceptions a `WITH` clause may name, in either tier. */
export const EXCEPTIONS: readonly string[] = ["LLVM-exception"];

/** One Bun runtime entry that may use a license ID outside the tiers (amendment 044 item 3). */
export interface RuntimeEntryException {
  /** The exact `name@version` of a Bun manifest entry. */
  entry: string;
  /** The one SPDX ID the entry may use on top of the runtime tier. */
  spdx: string;
  amendment: string;
  /** Printed under the entry's `Source:` line in the notices file. */
  note: string;
}

/** Bun manifest entries that pass with an ID outside both tiers, each approved for one exact version. Adding one takes an amendment. */
export const RUNTIME_ENTRY_EXCEPTIONS: readonly RuntimeEntryException[] = [
  {
    entry: "domain-browser@4.23.0",
    spdx: "Artistic-2.0",
    amendment: "amendment 044",
    note: "Accepted under amendment 044. Bun's LICENSE.md lists domain-browser as MIT. Versions up to 4.22.0 were MIT, but 4.23.0, the version Bun bundles, is Artistic-2.0, and its own LICENSE.md below governs.",
  },
];

/** Dev dependencies whose output ends up in the bundle. They are walked like production dependencies. */
export const EMBEDDED_DEV_PACKAGES: readonly string[] = [];

export type Tier = "permissive" | "runtime";

type Verdict = { ok: true } | { ok: false; reason: string };

const OPERATORS = new Set(["and", "or", "with"]);
const knownIds = new Map<string, string>();
for (const id of [
  ...licenseIds,
  ...deprecatedLicenseIds,
  ...exceptionIds,
  ...deprecatedExceptionIds,
]) {
  knownIds.set(id.toLowerCase(), id);
}

/** Rewrites each ID and operator in its canonical case, so matching is case-insensitive. Unknown words pass through unchanged. */
function canonicalCase(expression: string): string {
  return expression.replace(/[A-Za-z0-9.:_+-]+/g, (word) => {
    const lower = word.toLowerCase();
    if (OPERATORS.has(lower)) return lower.toUpperCase();
    const plus = lower.endsWith("+") && lower.length > 1;
    const known = knownIds.get(plus ? lower.slice(0, -1) : lower);
    return known === undefined ? word : plus ? `${known}+` : known;
  });
}

interface Check {
  pass: boolean;
  failed: string[];
}

function evaluate(
  node: ReturnType<typeof parseSpdx>,
  allowed: Set<string>,
  exceptions: Set<string>,
): Check {
  if ("left" in node) {
    const left = evaluate(node.left, allowed, exceptions);
    const right = evaluate(node.right, allowed, exceptions);
    if (node.conjunction === "or") {
      return {
        pass: left.pass || right.pass,
        failed:
          left.pass || right.pass ? [] : [...left.failed, ...right.failed],
      };
    }
    return {
      pass: left.pass && right.pass,
      failed: [...left.failed, ...right.failed],
    };
  }
  const id = node.plus ? `${node.license}-or-later` : node.license;
  const failed: string[] = [];
  if (!allowed.has(id.toLowerCase())) failed.push(id);
  if (
    node.exception !== undefined &&
    !exceptions.has(node.exception.toLowerCase())
  ) {
    failed.push(`${node.license} WITH ${node.exception}`);
  }
  return { pass: failed.length === 0, failed };
}

/** Checks one license string against a tier. Anything that is not strict SPDX fails, with no normalising. `extraIds` are accepted on top of the tier, for a matched runtime entry exception. */
export function checkExpression(
  expression: string,
  tier: Tier,
  extraIds: readonly string[] = [],
): Verdict {
  let tree: ReturnType<typeof parseSpdx>;
  try {
    tree = parseSpdx(canonicalCase(expression));
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reason: `"${expression}" is not a valid SPDX expression (${why})`,
    };
  }
  const ids = tier === "runtime" ? RUNTIME_TIER : PERMISSIVE_TIER;
  const result = evaluate(
    tree,
    new Set([...ids, ...extraIds].map((id) => id.toLowerCase())),
    new Set(EXCEPTIONS.map((e) => e.toLowerCase())),
  );
  if (result.pass) return { ok: true };
  return {
    ok: false,
    reason: `"${expression}" is outside the ${tier} tier (${[...new Set(result.failed)].join(", ")})`,
  };
}

/** An override for one `name@version`: the SPDX expression to use, why, and where its license text lives. */
export interface Override {
  spdx: string;
  reason: string;
  /** `package:<path>` is relative to the package, anything else is relative to `scripts/notices/`. */
  text: string;
}
export type Overrides = Record<string, Override>;

export interface NoticeEntry {
  name: string;
  version: string;
  spdx: string;
  origin: "npm" | "bun";
  /** Set for Bun runtime components that only some builds include. */
  builds: string | null;
  source: string | null;
  /** The matched runtime entry exception's note, printed under `Source:`. */
  note: string | null;
  texts: { file: string; text: string }[];
}

export interface NoticesOptions {
  rootDir: string;
  /** Directories, relative to `rootDir`, whose `package.json` dependencies start the walk. */
  roots: string[];
  /** The checked-in Bun manifest, or null to skip it. */
  manifestPath: string | null;
  overrides: Overrides;
  /** The directory `Override.text` paths and the manifest's `texts/` resolve against. */
  noticesDir: string;
  embeddedDevPackages: readonly string[];
  /** Applies to Bun manifest entries only, never to npm packages or overrides. */
  runtimeEntryExceptions: readonly RuntimeEntryException[];
  lockfilePath: string | null;
  /** `packageManager` from the root `package.json`, for the Bun manifest's version pin. */
  packageManager: string | null;
  /** The directory name packages install into. Tests point it away from `node_modules` so fixtures can be committed. */
  modulesDirName: string;
}

export interface NoticesResult {
  entries: NoticeEntry[];
  problems: string[];
  /** Bun manifest entries flagged `blockedUntilAmendment` that still fail the runtime tier. */
  blocked: string[];
}

interface ManifestComponent {
  name: string;
  version: string;
  spdx: string;
  source: string;
  targets: string[];
  texts: string[];
  blockedUntilAmendment?: boolean;
}
interface Manifest {
  bunVersion: string;
  targets: string[];
  components: ManifestComponent[];
}

interface PackageJson {
  name?: string;
  version?: string;
  license?: unknown;
  licenses?: unknown;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

function readText(path: string): string | null {
  if (!isFile(path)) return null;
  const text = readFileSync(path, "utf8");
  return text.trim() === "" ? null : text;
}

const LICENSE_FILE = /^(licen[sc]e|copying)(?:[-_. ].*)?$/i;
const NOTICE_FILE = /^notice(?:[-_. ].*)?$/i;

function filesMatching(
  dir: string,
  pattern: RegExp,
): { file: string; text: string }[] {
  const found: { file: string; text: string }[] = [];
  for (const file of readdirSync(dir).sort()) {
    if (!pattern.test(file)) continue;
    const text = readText(join(dir, file));
    if (text !== null) found.push({ file, text });
  }
  return found;
}

function packageKey(name: string, version: string): string {
  return `${name}@${version}`;
}

/** Looks `name` up the way Node does, from `fromDir` up to `rootDir`. Returns the package's real directory. */
function resolvePackage(
  name: string,
  fromDir: string,
  rootDir: string,
  modulesDirName: string,
): string | null {
  let dir = fromDir;
  for (;;) {
    const modules =
      basename(dir) === modulesDirName ? dir : join(dir, modulesDirName);
    const candidate = join(modules, name);
    if (isFile(join(candidate, "package.json"))) return realpathSync(candidate);
    if (dir === rootDir || dirname(dir) === dir) return null;
    dir = dirname(dir);
  }
}

/** A package is first-party when its real path is inside the repo and not under an install directory. */
function isFirstParty(
  dir: string,
  rootDir: string,
  modulesDirName: string,
): boolean {
  const rel = relative(rootDir, dir);
  if (rel.startsWith("..") || resolve(rootDir, rel) !== dir) return false;
  return !rel.split(sep).includes(modulesDirName);
}

interface Walked {
  name: string;
  version: string;
  dir: string;
  pkg: PackageJson;
}

function walkClosure(
  opts: NoticesOptions,
  rootDir: string,
  problems: string[],
): Walked[] {
  const found = new Map<string, Walked>();
  const seen = new Set<string>();

  const visit = (dir: string, label: string, pkg: PackageJson): void => {
    const deps = { ...pkg.optionalDependencies, ...pkg.dependencies };
    for (const name of Object.keys(deps).sort()) {
      const optional =
        pkg.optionalDependencies?.[name] !== undefined &&
        pkg.dependencies?.[name] === undefined;
      const resolved = resolvePackage(name, dir, rootDir, opts.modulesDirName);
      if (resolved === null) {
        if (!optional) {
          problems.push(
            `${name}, a dependency of ${label}, is not installed. Run \`bun install\`.`,
          );
        }
        continue;
      }
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      const child = readJson<PackageJson>(join(resolved, "package.json"));
      if (!isFirstParty(resolved, rootDir, opts.modulesDirName)) {
        if (typeof child.version !== "string") {
          problems.push(
            `${name} at ${relative(rootDir, resolved)} has no version in its package.json.`,
          );
          continue;
        }
        const key = packageKey(child.name ?? name, child.version);
        if (!found.has(key)) {
          found.set(key, {
            name: child.name ?? name,
            version: child.version,
            dir: resolved,
            pkg: child,
          });
        }
      }
      visit(
        resolved,
        packageKey(child.name ?? name, child.version ?? "?"),
        child,
      );
    }
  };

  for (const root of opts.roots) {
    const dir = realpathSync(join(rootDir, root));
    visit(
      dir,
      root === "." ? "the root package" : root,
      readJson<PackageJson>(join(dir, "package.json")),
    );
  }
  if (opts.embeddedDevPackages.length > 0) {
    visit(rootDir, "EMBEDDED_DEV_PACKAGES", {
      dependencies: Object.fromEntries(
        opts.embeddedDevPackages.map((n) => [n, "*"]),
      ),
    });
  }
  return [...found.values()];
}

function lockfileNames(path: string): Set<string> {
  const lock = Bun.JSONC.parse(readFileSync(path, "utf8")) as {
    packages?: Record<string, unknown[]>;
  };
  const names = new Set<string>();
  for (const value of Object.values(lock.packages ?? {})) {
    const id = value[0];
    if (typeof id !== "string") continue;
    names.add(id.slice(0, id.lastIndexOf("@")));
  }
  return names;
}

function overrideText(
  override: Override,
  pkgDir: string,
  noticesDir: string,
): { file: string; text: string } | null {
  const path = override.text.startsWith("package:")
    ? join(pkgDir, override.text.slice("package:".length))
    : join(noticesDir, override.text);
  const text = readText(path);
  return text === null ? null : { file: override.text, text };
}

function licenseOf(pkg: PackageJson): { spdx: string } | { problem: string } {
  if (typeof pkg.license === "string" && pkg.license.trim() !== "") {
    return { spdx: pkg.license.trim() };
  }
  if (pkg.licenses !== undefined) {
    return {
      problem:
        'uses the legacy "licenses" array. Add an override with an SPDX expression',
    };
  }
  if (pkg.license !== undefined) {
    return {
      problem:
        'has a "license" field that is not an SPDX string. Add an override with an SPDX expression',
    };
  }
  return {
    problem: 'has no "license" field. Add an override with an SPDX expression',
  };
}

function npmEntries(
  opts: NoticesOptions,
  rootDir: string,
  problems: string[],
): NoticeEntry[] {
  const walked = walkClosure(opts, rootDir, problems);
  const keys = new Set(walked.map((w) => packageKey(w.name, w.version)));
  const entries: NoticeEntry[] = [];

  for (const [key, override] of Object.entries(opts.overrides)) {
    if (!keys.has(key))
      problems.push(
        `Override ${key} is stale: that package is not in the dependency closure.`,
      );
    if (
      override.spdx.trim() === "" ||
      override.reason.trim() === "" ||
      override.text.trim() === ""
    ) {
      problems.push(`Override ${key} needs a non-empty spdx, reason and text.`);
    }
  }

  for (const { name, version, dir, pkg } of walked) {
    const key = packageKey(name, version);
    const override = opts.overrides[key];
    let spdx: string;
    if (override !== undefined) {
      spdx = override.spdx;
    } else {
      const license = licenseOf(pkg);
      if ("problem" in license) {
        problems.push(`${key} ${license.problem}.`);
        continue;
      }
      spdx = license.spdx;
    }
    const verdict = checkExpression(spdx, "permissive");
    if (!verdict.ok) {
      problems.push(
        `${key}${override ? " (override)" : ""}: ${verdict.reason}.`,
      );
      continue;
    }

    let texts: { file: string; text: string }[];
    if (override !== undefined) {
      const text = overrideText(override, dir, opts.noticesDir);
      if (text === null) {
        problems.push(
          `Override ${key} points at a license text that is missing or empty: ${override.text}.`,
        );
        continue;
      }
      texts = [text];
    } else {
      texts = filesMatching(dir, LICENSE_FILE);
      if (texts.length === 0) {
        problems.push(
          `${key} has no license text (no LICENSE, LICENCE or COPYING file). Add an override that names one.`,
        );
        continue;
      }
    }
    if (/\bApache-2\.0\b/i.test(spdx))
      texts.push(...filesMatching(dir, NOTICE_FILE));
    entries.push({
      name,
      version,
      spdx,
      origin: "npm",
      builds: null,
      source: null,
      note: null,
      texts,
    });
  }
  return entries;
}

const OS_NAMES: Record<string, string> = {
  linux: "Linux",
  windows: "Windows",
  darwin: "macOS",
};

/** Names the builds that carry a component, or null when every build does. */
function buildsLabel(targets: string[], all: string[]): string | null {
  if (all.every((t) => targets.includes(t))) return null;
  const parts: string[] = [];
  const osList = [...new Set(targets.map((t) => t.split("-")[0] ?? t))];
  for (const os of osList) {
    const ofOs = all.filter((t) => t.startsWith(`${os}-`));
    if (ofOs.length > 0 && ofOs.every((t) => targets.includes(t))) {
      parts.push(OS_NAMES[os] ?? os);
    } else {
      parts.push(...targets.filter((t) => t.startsWith(`${os}-`)));
    }
  }
  return `${parts.join(" and ")} builds`;
}

/** The problems with a `packageManager` string and the Bun version a manifest is for, empty when they match. */
export function bunPinProblems(
  packageManager: string | null,
  manifestVersion: string,
): string[] {
  const pinned =
    packageManager === null
      ? null
      : /^bun@(\d+\.\d+\.\d+)$/.exec(packageManager)?.[1];
  if (pinned === undefined || pinned === null) {
    return [`packageManager "${packageManager ?? ""}" is not bun@<version>.`];
  }
  if (pinned !== manifestVersion) {
    return [
      `packageManager pins Bun ${pinned} but bun-runtime.json is for Bun ${manifestVersion}. Redo the manifest for ${pinned}.`,
    ];
  }
  return [];
}

function bunEntries(
  opts: NoticesOptions,
  manifestPath: string,
  problems: string[],
  blocked: string[],
): NoticeEntry[] {
  const manifest = readJson<Manifest>(manifestPath);
  problems.push(...bunPinProblems(opts.packageManager, manifest.bunVersion));
  const entries: NoticeEntry[] = [];
  const manifestKeys = new Set(
    manifest.components.map((c) => packageKey(c.name, c.version)),
  );
  for (const exception of opts.runtimeEntryExceptions) {
    if (!manifestKeys.has(exception.entry)) {
      problems.push(
        `Runtime entry exception ${exception.entry} is stale: that component is not in the Bun manifest.`,
      );
    }
  }
  for (const c of manifest.components) {
    const key = packageKey(c.name, c.version);
    const exception = opts.runtimeEntryExceptions.find((e) => e.entry === key);
    const verdict = checkExpression(
      c.spdx,
      "runtime",
      exception === undefined ? [] : [exception.spdx],
    );
    if (!verdict.ok) {
      if (c.blockedUntilAmendment) blocked.push(key);
      else problems.push(`Bun runtime component ${key}: ${verdict.reason}.`);
    } else if (c.blockedUntilAmendment) {
      problems.push(
        `Bun runtime component ${key} now passes the runtime tier. Remove its blockedUntilAmendment flag.`,
      );
    }
    const texts: { file: string; text: string }[] = [];
    for (const file of c.texts) {
      const text = readText(join(opts.noticesDir, file));
      if (text === null)
        problems.push(
          `Bun runtime component ${key} lists a license text that is missing or empty: ${file}.`,
        );
      else texts.push({ file, text });
    }
    if (c.texts.length === 0)
      problems.push(`Bun runtime component ${key} lists no license text.`);
    entries.push({
      name: c.name,
      version: c.version,
      spdx: c.spdx,
      origin: "bun",
      builds: buildsLabel(c.targets, manifest.targets),
      source: c.source,
      note: exception?.note ?? null,
      texts,
    });
  }
  return entries;
}

/** Orders entries by name, then version numerically, then origin. */
export function compareEntries(a: NoticeEntry, b: NoticeEntry): number {
  const name = a.name.toLowerCase();
  const other = b.name.toLowerCase();
  if (name !== other) return name < other ? -1 : 1;
  if (a.version !== b.version) {
    return a.version.localeCompare(b.version, "en", { numeric: true });
  }
  return a.origin < b.origin ? -1 : a.origin > b.origin ? 1 : 0;
}

/** Walks the production closure, reads the Bun manifest and checks everything against the tiers. Writes nothing. */
export function collectNotices(opts: NoticesOptions): NoticesResult {
  const rootDir = realpathSync(opts.rootDir);
  const problems: string[] = [];
  const blocked: string[] = [];

  if (opts.embeddedDevPackages.length > 0) {
    const names =
      opts.lockfilePath !== null && existsSync(opts.lockfilePath)
        ? lockfileNames(opts.lockfilePath)
        : null;
    for (const name of opts.embeddedDevPackages) {
      if (names === null || !names.has(name)) {
        problems.push(
          `EMBEDDED_DEV_PACKAGES names ${name}, which is not in the lockfile.`,
        );
      }
    }
  }

  const entries = npmEntries(opts, rootDir, problems);
  if (opts.manifestPath !== null) {
    entries.push(...bunEntries(opts, opts.manifestPath, problems, blocked));
  }
  entries.sort(compareEntries);
  return { entries, problems, blocked: blocked.sort() };
}

const RULE = "=".repeat(78);

/** The text of `THIRD-PARTY-NOTICES.txt`: one section per entry, sorted by name then version. */
export function renderNotices(entries: NoticeEntry[]): string {
  const sections = entries.map((e) => {
    const head = [`${e.name} ${e.version}`, `License: ${e.spdx}`];
    if (e.builds !== null) head.push(`Included in: ${e.builds}`);
    if (e.source !== null) head.push(`Source: ${e.source}`);
    if (e.note !== null) head.push(e.note);
    const body = e.texts.map(
      (t) => (e.texts.length > 1 ? `--- ${t.file} ---\n` : "") + t.text.trim(),
    );
    return [head.join("\n"), ...body].join("\n\n");
  });
  return [
    "THIRD-PARTY NOTICES",
    "",
    "Pokemon Memory Reader includes the software below. Each entry gives its license and the license text.",
    "",
    sections.join(`\n\n${RULE}\n\n`),
    "",
  ].join("\n");
}

const REPO_ROOT = resolve(import.meta.dir, "..");

/** The options CI and the release build use: the repo's own workspaces, overrides and Bun manifest. */
export function repoOptions(): NoticesOptions {
  const noticesDir = join(REPO_ROOT, "scripts/notices");
  const overridesPath = join(REPO_ROOT, "scripts/notices.overrides.json");
  return {
    rootDir: REPO_ROOT,
    roots: ["server", "viewer"],
    manifestPath: join(noticesDir, "bun-runtime.json"),
    overrides: existsSync(overridesPath)
      ? readJson<Overrides>(overridesPath)
      : {},
    noticesDir,
    embeddedDevPackages: EMBEDDED_DEV_PACKAGES,
    runtimeEntryExceptions: RUNTIME_ENTRY_EXCEPTIONS,
    lockfilePath: join(REPO_ROOT, "bun.lock"),
    packageManager:
      readJson<{ packageManager?: string }>(join(REPO_ROOT, "package.json"))
        .packageManager ?? null,
    modulesDirName: "node_modules",
  };
}

const USAGE =
  "Usage: bun scripts/notices.ts [--check [--strict]] [--out <file>]";

export interface Output {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * The command line. `--check` is the CI step: it writes nothing and treats blocked Bun entries as warnings.
 * Without it, or with `--strict`, a blocked entry fails the run, so a release build can't ship a partial manifest as complete.
 * Returns the exit code.
 */
export function run(
  args: string[],
  opts: NoticesOptions,
  out: Output,
  outputPath: string = join(opts.rootDir, "THIRD-PARTY-NOTICES.txt"),
): number {
  const check = args.includes("--check");
  const strict = args.includes("--strict") || !check;
  const outIndex = args.indexOf("--out");
  const known = new Set(["--check", "--strict", "--out"]);
  if (
    args.some((a) => a.startsWith("--") && !known.has(a)) ||
    (outIndex !== -1 && args[outIndex + 1] === undefined)
  ) {
    out.error(USAGE);
    return 2;
  }
  const target =
    outIndex === -1 ? outputPath : resolve(args[outIndex + 1] ?? "");

  const { entries, problems, blocked } = collectNotices(opts);
  for (const key of blocked) {
    const message = `Bun runtime component ${key} is blocked until an amendment adds its license to the runtime tier.`;
    if (strict) problems.push(message);
    else out.warn(`warning: ${message}`);
  }
  if (problems.length > 0) {
    for (const p of problems) out.error(`error: ${p}`);
    out.error(
      `Notices check failed with ${problems.length} problem${problems.length === 1 ? "" : "s"}.`,
    );
    return 1;
  }
  const npm = entries.filter((e) => e.origin === "npm").length;
  const counts = `${npm} npm packages, ${entries.length - npm} Bun runtime components`;
  if (check) {
    out.log(`Notices check passed: ${counts}.`);
  } else {
    writeFileSync(target, renderNotices(entries));
    out.log(`Wrote ${target}: ${counts}.`);
  }
  return 0;
}

if (import.meta.main) {
  process.exit(run(process.argv.slice(2), repoOptions(), console));
}
