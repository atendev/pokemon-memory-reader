import { createHash } from "node:crypto";
import {
  appendFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  collectNotices,
  needsLgplTerm,
  REPO_URL,
  RUNTIME_ENTRY_EXCEPTIONS,
  type RuntimeEntryException,
  renderLgplSection,
  repoOptions,
} from "./notices";

const REPO_ROOT = resolve(import.meta.dir, "..");
export const MANIFEST_PATH = join(
  REPO_ROOT,
  "scripts/notices/bun-runtime.json",
);
export const RELINK_DOC = "docs/lgpl-relinking.md";
const GITHUB = "https://github.com";

/** GitHub release assets must stay under 2 GiB (amendment 042 §4). An archive at or above this is split. */
export const SPLIT_AT_BYTES = 2 * 1024 ** 3;
/** Each part is `split -b 1900M`, which keeps it under the asset limit. */
export const PART_BYTES = 1900 * 1024 ** 2;

export interface SourcePin {
  id: "bun" | "webkit" | "tinycc";
  label: string;
  /** `owner/name` on GitHub. */
  repo: string;
  commit: string;
  /** Set for Bun, whose pin is a release tag as well as a commit. */
  tag: string | null;
  /** The release asset name, before any `.NNN` part suffix. */
  asset: string;
}

interface ManifestFile {
  bunVersion: string;
  sourceTag: string;
  sourceCommit: string;
  components: {
    name: string;
    version: string;
    spdx: string;
    source?: string;
    displayName?: string;
    upstream?: { repo: string; commit: string };
  }[];
}

/** The `source` URL of a Bun manifest entry that a runtime entry exception matches. */
export interface ExceptionSource {
  /** The exact `name@version` of the entry. */
  entry: string;
  /** Empty when the manifest entry has none. */
  source: string;
}

/**
 * The `source` URL of every Bun manifest entry that a runtime entry exception matches (amendment 044 item 5).
 * An exception with no manifest entry is stale, which `notices --check` reports, so it is skipped here.
 */
export function readExceptionSources(
  manifestPath: string = MANIFEST_PATH,
  exceptions: readonly RuntimeEntryException[] = RUNTIME_ENTRY_EXCEPTIONS,
): ExceptionSource[] {
  const manifest: ManifestFile = JSON.parse(readFileSync(manifestPath, "utf8"));
  const sources: ExceptionSource[] = [];
  for (const exception of exceptions) {
    const component = manifest.components.find(
      (c) => `${c.name}@${c.version}` === exception.entry,
    );
    if (component) {
      sources.push({ entry: exception.entry, source: component.source ?? "" });
    }
  }
  return sources;
}

const SHA = /^[0-9a-f]{40}$/;
const ARCHIVE_IDS = ["webkit", "tinycc"] as const;

/**
 * The three pins the release builds archives from: Bun at its tag, plus every LGPL component in the manifest.
 * Throws when a pin is malformed or an LGPL component has no archive plan, so a manifest edit can't skip a source asset.
 */
export function readPins(manifestPath: string = MANIFEST_PATH): SourcePin[] {
  const manifest: ManifestFile = JSON.parse(readFileSync(manifestPath, "utf8"));
  const pins: SourcePin[] = [];
  if (!SHA.test(manifest.sourceCommit)) {
    throw new Error(
      `bun-runtime.json sourceCommit "${manifest.sourceCommit}" is not a 40-character commit.`,
    );
  }
  pins.push({
    id: "bun",
    label: `Bun ${manifest.bunVersion}`,
    repo: "oven-sh/bun",
    commit: manifest.sourceCommit,
    tag: manifest.sourceTag,
    asset: `bun-${manifest.bunVersion}-source.tar.gz`,
  });
  for (const c of manifest.components) {
    if (!needsLgplTerm(c.spdx)) continue;
    const id = ARCHIVE_IDS.find((i) => i === c.name.toLowerCase());
    if (id === undefined) {
      throw new Error(
        `LGPL component ${c.name} ${c.version} has no source archive plan in scripts/lgpl-sources.ts.`,
      );
    }
    if (!c.upstream || !SHA.test(c.upstream.commit)) {
      throw new Error(
        `LGPL component ${c.name} ${c.version} needs upstream.repo and a 40-character upstream.commit in bun-runtime.json.`,
      );
    }
    pins.push({
      id,
      label: c.displayName ?? c.name,
      repo: c.upstream.repo,
      commit: c.upstream.commit,
      tag: null,
      asset: `${id}-${c.upstream.commit.slice(0, 12)}-source.tar.${id === "webkit" ? "xz" : "gz"}`,
    });
  }
  for (const id of ARCHIVE_IDS) {
    if (!pins.some((p) => p.id === id)) {
      throw new Error(
        `bun-runtime.json has no LGPL entry for ${id}, so the release would carry no ${id} source.`,
      );
    }
  }
  return pins;
}

/** Runs a command and returns its stdout. Throws with the command and its stderr when it exits non-zero. */
export type Run = (
  cmd: string[],
  opts?: { cwd?: string; env?: Record<string, string> },
) => string;

export const runCommand: Run = (cmd, opts) => {
  const result = Bun.spawnSync(cmd, {
    cwd: opts?.cwd,
    env: { ...process.env, ...opts?.env },
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `\`${cmd.join(" ")}\` failed with exit ${result.exitCode}: ${result.stderr.toString().trim()}`,
    );
  }
  return result.stdout.toString();
};

export interface BuildOptions {
  outDir: string;
  /** Where upstream repos live. Tests point it at local repos. */
  baseUrl?: string;
  run?: Run;
  splitAt?: number;
  partBytes?: number;
}

/**
 * Fetches `pin.commit` from upstream with a shallow fetch and writes `<outDir>/<pin.asset>`.
 * GitHub refuses codeload tarballs for oven-sh/WebKit, so every pin goes through `git fetch`.
 * The tree is archived whole, `.git` aside, with sorted entries and the commit's time so a rebuild gives the same bytes.
 */
export function buildArchive(pin: SourcePin, opts: BuildOptions): string {
  const run = opts.run ?? runCommand;
  const base = opts.baseUrl ?? GITHUB;
  // Scratch sits beside the output, never in /tmp: that can be RAM-backed, and a WebKit checkout is several GB.
  mkdirSync(opts.outDir, { recursive: true });
  const work = mkdtempSync(join(resolve(opts.outDir), `.work-${pin.id}-`));
  try {
    const dirName = pin.asset.replace(/-source\.tar\.(gz|xz)$/, "");
    const tree = join(work, dirName);
    mkdirSync(tree);
    run(["git", "init", "-q", tree]);
    run([
      "git",
      "-C",
      tree,
      "fetch",
      "-q",
      "--depth",
      "1",
      "--no-tags",
      `${base}/${pin.repo}`,
      pin.commit,
    ]);
    run(["git", "-C", tree, "checkout", "-q", "--detach", "FETCH_HEAD"]);
    const head = run(["git", "-C", tree, "rev-parse", "HEAD"]).trim();
    if (head !== pin.commit) {
      throw new Error(
        `${pin.label}: fetched ${head} but the manifest pins ${pin.commit}.`,
      );
    }
    const time = run([
      "git",
      "-C",
      tree,
      "show",
      "-s",
      "--format=%ct",
      "HEAD",
    ]).trim();
    mkdirSync(opts.outDir, { recursive: true });
    const archive = join(resolve(opts.outDir), pin.asset);
    run(
      [
        "tar",
        "--sort=name",
        `--mtime=@${time}`,
        "--owner=0",
        "--group=0",
        "--numeric-owner",
        "--exclude=.git",
        pin.asset.endsWith(".xz") ? "-cJf" : "-czf",
        archive,
        "-C",
        work,
        dirName,
      ],
      { env: { XZ_OPT: "-T0" } },
    );
    return archive;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** The numbered part names the split uses, in order: `<asset>.000`, `<asset>.001`, and so on. */
export function partName(asset: string, index: number): string {
  return `${asset}.${String(index).padStart(3, "0")}`;
}

/** Splits an archive at or above the limit and removes the whole file. Returns the files to upload. */
export function splitIfLarge(
  archive: string,
  opts: Pick<BuildOptions, "run" | "splitAt" | "partBytes">,
): string[] {
  const size = statSync(archive).size;
  if (size < (opts.splitAt ?? SPLIT_AT_BYTES)) return [archive];
  const run = opts.run ?? runCommand;
  run([
    "split",
    "-b",
    String(opts.partBytes ?? PART_BYTES),
    "-d",
    "-a",
    "3",
    archive,
    `${archive}.`,
  ]);
  const parts: string[] = [];
  for (let i = 0; existsSync(`${archive}.${String(i).padStart(3, "0")}`); i++) {
    parts.push(`${archive}.${String(i).padStart(3, "0")}`);
  }
  rmSync(archive);
  return parts;
}

export function sha256File(path: string): Promise<string> {
  return new Promise((done, fail) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => done(hash.digest("hex")))
      .on("error", fail);
  });
}

/** Adds `<hash>  <name>` lines to a `SHA256SUMS` file. A name that is already listed fails, so a rerun can't double a line. */
export function appendSums(
  sumsFile: string,
  lines: { name: string; hash: string }[],
): void {
  const existing = existsSync(sumsFile) ? readFileSync(sumsFile, "utf8") : "";
  const listed = parseSums(existing);
  for (const { name } of lines) {
    if (listed.has(name)) {
      throw new Error(`${sumsFile} already lists ${name}.`);
    }
  }
  const prefix = existing === "" || existing.endsWith("\n") ? "" : "\n";
  appendFileSync(
    sumsFile,
    prefix + lines.map((l) => `${l.hash}  ${l.name}\n`).join(""),
  );
}

/** Reads a `SHA256SUMS` file into a name to hash map. */
export function parseSums(text: string): Map<string, string> {
  const sums = new Map<string, string>();
  for (const line of text.split("\n")) {
    const m = /^([0-9a-f]{64}) [ *](.+)$/.exec(line);
    if (m?.[1] && m[2]) sums.set(m[2], m[1]);
  }
  return sums;
}

/**
 * Builds every source archive into `outDir` and lists each file in the sums file. Any failed fetch throws,
 * so the release job stops before it uploads anything. Returns the files written.
 */
export async function buildAll(
  pins: SourcePin[],
  sumsFile: string,
  opts: BuildOptions,
): Promise<string[]> {
  const files: string[] = [];
  for (const pin of pins) {
    files.push(...splitIfLarge(buildArchive(pin, opts), opts));
  }
  const lines = [];
  for (const file of files) {
    lines.push({
      name: file.split("/").pop() ?? file,
      hash: await sha256File(file),
    });
  }
  appendSums(sumsFile, lines);
  return files;
}

// --- Release body ---

const BODY_HEADING = "### Source for the LGPL libraries";

/** Every upstream link the release body carries: the tree for each pin. */
export function upstreamUrl(pin: SourcePin): string {
  return `${GITHUB}/${pin.repo}/tree/${pin.tag ?? pin.commit}`;
}

/** The release body section: the relink steps at the tag, the upstream links and the fetch lines (amendment 042 §5). */
export function bodySection(pins: SourcePin[], tag: string): string {
  return [
    BODY_HEADING,
    "",
    "This program statically links JavaScriptCore (WebKit) and tinycc, which are under the GNU LGPL. The source for Bun, WebKit and tinycc at the versions in this build is attached to this release and listed in `SHA256SUMS`.",
    "",
    `Steps to rebuild with your own changes: ${REPO_URL}/blob/${tag}/${RELINK_DOC}`,
    "",
    ...pins.map((p) => `- ${p.label}: ${upstreamUrl(p)}`),
    "",
    "```sh",
    ...pins.map((p) => `git fetch --depth 1 ${GITHUB}/${p.repo} ${p.commit}`),
    "```",
    "",
  ].join("\n");
}

/** Adds the section after the body. A second run fails instead of doubling it. */
export function withBodySection(
  body: string,
  pins: SourcePin[],
  tag: string,
): string {
  if (body.includes(BODY_HEADING)) {
    throw new Error(
      `The release body already has a "${BODY_HEADING}" section.`,
    );
  }
  return `${body.trimEnd()}\n\n${bodySection(pins, tag)}`;
}

// --- Checks ---

/**
 * The offline check, with no network. Every LGPL component carries its notice fields, the notices LGPL section names it,
 * and `docs/lgpl-relinking.md` names each archive, commit and the Bun tag the manifest pins.
 */
export function checkOffline(
  manifestPath: string = MANIFEST_PATH,
  docPath: string = join(REPO_ROOT, RELINK_DOC),
  noticesRoot: Parameters<typeof collectNotices>[0] = {
    ...repoOptions(),
    roots: [],
  },
): string[] {
  const problems: string[] = [];
  let pins: SourcePin[];
  try {
    pins = readPins(manifestPath);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  const { entries, problems: noticeProblems } = collectNotices({
    ...noticesRoot,
    manifestPath,
  });
  problems.push(...noticeProblems);
  const section = renderLgplSection(entries) ?? "";
  for (const pin of pins.filter((p) => p.id !== "bun")) {
    if (!section.includes(pin.commit)) {
      problems.push(
        `The notices LGPL section does not name ${pin.label} at ${pin.commit}.`,
      );
    }
  }
  if (!existsSync(docPath)) {
    problems.push(`${RELINK_DOC} is missing.`);
    return problems;
  }
  const doc = readFileSync(docPath, "utf8");
  for (const pin of pins) {
    for (const needle of [pin.asset, pin.tag ?? pin.commit]) {
      if (!doc.includes(needle)) {
        problems.push(
          `${RELINK_DOC} does not mention ${needle} (${pin.label}). Update it to match bun-runtime.json.`,
        );
      }
    }
  }
  return problems;
}

export interface ReleaseAsset {
  name: string;
  size: number;
}

export interface ReleaseInfo {
  assets: ReleaseAsset[];
  /** The text of the `SHA256SUMS` asset. */
  sums: string;
  body: string;
}

/**
 * Compares one pin's source asset with a release's assets. A whole file, or contiguous `.000` parts with
 * every part but the last at the full part size, must be present and each listed in `SHA256SUMS`.
 */
export function checkAssets(
  pin: SourcePin,
  assets: ReleaseAsset[],
  sums: Map<string, string>,
): string[] {
  const problems: string[] = [];
  const whole = assets.find((a) => a.name === pin.asset);
  const partPattern = new RegExp(
    `^${pin.asset.replace(/\./g, "\\.")}\\.(\\d{3})$`,
  );
  const parts = assets
    .filter((a) => partPattern.test(a.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const names: string[] = [];
  if (whole && parts.length > 0) {
    problems.push(`${pin.asset} is attached whole and as parts.`);
  } else if (whole) {
    names.push(whole.name);
  } else if (parts.length === 0) {
    problems.push(`The release has no ${pin.asset} (${pin.label} source).`);
  } else {
    names.push(...parts.map((p) => p.name));
    parts.forEach((part, i) => {
      if (part.name !== partName(pin.asset, i)) {
        problems.push(
          `${pin.asset} parts skip from ${i === 0 ? "the start" : partName(pin.asset, i - 1)} to ${part.name}.`,
        );
      }
    });
    if (parts.length < 2) {
      problems.push(
        `${pin.asset} has one part. Attach the whole file or at least two parts.`,
      );
    }
    for (const part of parts.slice(0, -1)) {
      if (part.size !== PART_BYTES) {
        problems.push(
          `${part.name} is ${part.size} bytes but every part before the last is ${PART_BYTES}. A part is missing or cut short.`,
        );
      }
    }
    const last = parts[parts.length - 1];
    if (last && (last.size === 0 || last.size > PART_BYTES)) {
      problems.push(`${last.name} has a bad size of ${last.size} bytes.`);
    }
  }
  for (const name of names) {
    if (!sums.has(name)) problems.push(`SHA256SUMS does not list ${name}.`);
  }
  // A line for a part the release doesn't carry means parts went missing or the part count changed.
  const assetsValid = names.length > 0 && problems.length === 0;
  for (const listed of sums.keys()) {
    if (
      assetsValid &&
      (listed === pin.asset || partPattern.test(listed)) &&
      !names.includes(listed)
    ) {
      problems.push(
        `SHA256SUMS lists ${listed} but the release has no such asset.`,
      );
    }
  }
  return problems;
}

/** What the online check asks of GitHub. Tests stub it. */
export interface Upstream {
  /** True when `repo` has this commit. */
  commitExists(repo: string, commit: string): Promise<boolean>;
  /** The commit a tag points at (peeled for annotated tags), or null when the tag doesn't exist. */
  tagCommit(repo: string, tag: string): Promise<string | null>;
  /** True when a request for `url` ends in a success status after redirects, false on 404 or 410. Throws on anything else. */
  urlResolves(url: string): Promise<boolean>;
}

/**
 * The online check. Every pinned commit and the Bun tag must resolve upstream. With a release, it must carry each source
 * asset, list each in `SHA256SUMS`, and put the upstream links and the relink steps in its body. Each exception
 * source URL must resolve.
 */
export async function checkOnline(
  pins: SourcePin[],
  upstream: Upstream,
  release?: ReleaseInfo,
  exceptionSources: ExceptionSource[] = [],
): Promise<string[]> {
  const problems: string[] = [];
  problems.push(...(await checkExceptionSources(exceptionSources, upstream)));
  for (const pin of pins) {
    try {
      if (!(await upstream.commitExists(pin.repo, pin.commit))) {
        problems.push(
          `${pin.label}: commit ${pin.commit} does not exist in ${pin.repo}.`,
        );
      }
      if (pin.tag !== null) {
        const found = await upstream.tagCommit(pin.repo, pin.tag);
        if (found === null) {
          problems.push(
            `${pin.label}: tag ${pin.tag} does not exist in ${pin.repo}.`,
          );
        } else if (found !== pin.commit) {
          problems.push(
            `${pin.label}: tag ${pin.tag} points at ${found}, not the pinned ${pin.commit}.`,
          );
        }
      }
    } catch (error) {
      problems.push(
        `${pin.label}: could not look up ${pin.repo}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (release) {
    const sums = parseSums(release.sums);
    for (const pin of pins) {
      problems.push(...checkAssets(pin, release.assets, sums));
      const link = upstreamUrl(pin);
      if (!release.body.includes(link)) {
        problems.push(`The release body does not link ${link}.`);
      }
    }
    if (!release.body.includes(RELINK_DOC)) {
      problems.push(`The release body does not link ${RELINK_DOC}.`);
    }
  }
  return problems;
}

/** Fails each exception entry whose `source` is empty, isn't an http(s) URL, or doesn't resolve. */
export async function checkExceptionSources(
  sources: ExceptionSource[],
  upstream: Upstream,
): Promise<string[]> {
  const problems: string[] = [];
  for (const { entry, source } of sources) {
    if (!/^https?:\/\/\S+$/.test(source)) {
      problems.push(
        `Runtime entry exception ${entry}: source "${source}" is not an http(s) URL.`,
      );
      continue;
    }
    try {
      if (!(await upstream.urlResolves(source))) {
        problems.push(
          `Runtime entry exception ${entry}: source ${source} does not resolve.`,
        );
      }
    } catch (error) {
      problems.push(
        `Runtime entry exception ${entry}: could not fetch ${source}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return problems;
}

/** GitHub's REST API, `git ls-remote`, and a plain request for source URLs. `GITHUB_TOKEN` lifts the anonymous rate limit when set. */
export const githubUpstream: Upstream = {
  async commitExists(repo, commit) {
    const token = process.env.GITHUB_TOKEN;
    const response = await fetch(
      `https://api.github.com/repos/${repo}/commits/${commit}`,
      {
        headers: {
          accept: "application/vnd.github+json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      },
    );
    if (response.status === 404 || response.status === 422) return false;
    if (!response.ok) {
      throw new Error(`GitHub answered ${response.status}.`);
    }
    const body = (await response.json()) as { sha?: string };
    return body.sha === commit;
  },
  async tagCommit(repo, tag) {
    const out = runCommand([
      "git",
      "ls-remote",
      `${GITHUB}/${repo}`,
      `refs/tags/${tag}`,
      `refs/tags/${tag}^{}`,
    ]);
    const refs = new Map<string, string>();
    for (const line of out.split("\n")) {
      const [sha, ref] = line.split("\t");
      if (sha && ref) refs.set(ref, sha);
    }
    return (
      refs.get(`refs/tags/${tag}^{}`) ?? refs.get(`refs/tags/${tag}`) ?? null
    );
  },
  async urlResolves(url) {
    const response = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (response.ok) return true;
    if (response.status === 404 || response.status === 410) return false;
    throw new Error(`${url} answered ${response.status}.`);
  },
};

/** Reads a release's assets, `SHA256SUMS` and body through the `gh` CLI. Works on a draft with the job's token. */
export function loadRelease(
  tag: string,
  repo: string,
  run: Run = runCommand,
): ReleaseInfo {
  const view = JSON.parse(
    run([
      "gh",
      "release",
      "view",
      tag,
      "--repo",
      repo,
      "--json",
      "assets,body",
    ]),
  ) as { assets: ReleaseAsset[]; body: string };
  const sums = view.assets.some((a) => a.name === "SHA256SUMS")
    ? run([
        "gh",
        "release",
        "download",
        tag,
        "--repo",
        repo,
        "--pattern",
        "SHA256SUMS",
        "--output",
        "-",
      ])
    : "";
  return { assets: view.assets, body: view.body, sums };
}

// --- Command line ---

const USAGE = `Usage:
  bun scripts/lgpl-sources.ts build [--out <dir>] [--sums <file>]
  bun scripts/lgpl-sources.ts body <body-file> --tag <tag>
  bun scripts/lgpl-sources.ts check [--online [--release <tag> --repo <owner/name>]]`;

function option(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

export async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args;
  try {
    if (command === "build") {
      const out = resolve(option(rest, "--out") ?? "out/lgpl-sources");
      const sums = resolve(option(rest, "--sums") ?? join(out, "SHA256SUMS"));
      const files = await buildAll(readPins(), sums, { outDir: out });
      for (const f of files) console.log(f);
      console.log(
        `Built ${files.length} source files and listed them in ${sums}.`,
      );
      return 0;
    }
    if (command === "body") {
      const bodyFile = rest[0];
      const tag = option(rest, "--tag");
      if (!bodyFile || !tag) {
        console.error(USAGE);
        return 2;
      }
      writeFileSync(
        bodyFile,
        withBodySection(readFileSync(bodyFile, "utf8"), readPins(), tag),
      );
      return 0;
    }
    if (command === "check") {
      const problems = checkOffline();
      if (rest.includes("--release") && !rest.includes("--online")) {
        console.error("--release only works with --online.");
        return 2;
      }
      if (rest.includes("--online")) {
        const tag = option(rest, "--release");
        const repo = option(rest, "--repo") ?? process.env.GITHUB_REPOSITORY;
        if (tag && !repo) {
          console.error(
            "--release needs --repo <owner/name> or GITHUB_REPOSITORY.",
          );
          return 2;
        }
        problems.push(
          ...(await checkOnline(
            readPins(),
            githubUpstream,
            tag && repo ? loadRelease(tag, repo) : undefined,
            readExceptionSources(),
          )),
        );
      }
      for (const p of problems) console.error(`error: ${p}`);
      if (problems.length > 0) {
        console.error(
          `LGPL check failed with ${problems.length} problem${problems.length === 1 ? "" : "s"}.`,
        );
        return 1;
      }
      console.log("LGPL check passed.");
      return 0;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
  console.error(USAGE);
  return 2;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
