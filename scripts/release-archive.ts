/// <reference path="../bridges/src/lua.d.ts" />
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { crc32, deflateRawSync } from "node:zlib";
import { DEFAULT_SETTINGS } from "@pokemon-memory-reader/internal/config";
import { BRIDGE_NAMES, generateBridges } from "../server/src/bridges";
import { appendSums, parseSums, sha256File } from "./lgpl-sources";

export const PROGRAM = "pokemon-memory-reader";

export interface Target {
  /** The `--target` value for `bun build --compile` (spec §13.1). */
  bun: string;
  os: "windows" | "linux" | "macos";
  arch: "x64" | "arm64";
  /** Windows and macOS archives are zips. Linux gets a tar.gz so the executable bit survives. */
  ext: "zip" | "tar.gz";
  /** The runner that builds the target: ubuntu for Windows and Linux, macOS arm for both macOS targets. */
  builder: "ubuntu" | "macos";
  /** The runner that smoke-tests the archive. */
  smokeRunner: string;
}

/** The six targets of spec §13.1. x64 uses the baseline variant. */
export const TARGETS: readonly Target[] = [
  {
    bun: "bun-windows-x64-baseline",
    os: "windows",
    arch: "x64",
    ext: "zip",
    builder: "ubuntu",
    smokeRunner: "windows-latest",
  },
  {
    bun: "bun-windows-arm64",
    os: "windows",
    arch: "arm64",
    ext: "zip",
    builder: "ubuntu",
    smokeRunner: "windows-11-arm",
  },
  {
    bun: "bun-linux-x64-baseline",
    os: "linux",
    arch: "x64",
    ext: "tar.gz",
    builder: "ubuntu",
    smokeRunner: "ubuntu-latest",
  },
  {
    bun: "bun-linux-arm64",
    os: "linux",
    arch: "arm64",
    ext: "tar.gz",
    builder: "ubuntu",
    smokeRunner: "ubuntu-24.04-arm",
  },
  {
    bun: "bun-darwin-x64-baseline",
    os: "macos",
    arch: "x64",
    ext: "zip",
    builder: "macos",
    smokeRunner: "macos-latest",
  },
  {
    bun: "bun-darwin-arm64",
    os: "macos",
    arch: "arm64",
    ext: "zip",
    builder: "macos",
    smokeRunner: "macos-latest",
  },
];

export function findTarget(bun: string): Target {
  const target = TARGETS.find((t) => t.bun === bun);
  if (!target) {
    throw new Error(
      `Unknown target ${bun}. Known targets: ${TARGETS.map((t) => t.bun).join(", ")}.`,
    );
  }
  return target;
}

/** `pokemon-memory-reader-v<version>-<os>-<arch>.<ext>` (spec §13.4). */
export function archiveName(version: string, target: Target): string {
  return `${PROGRAM}-v${version}-${target.os}-${target.arch}.${target.ext}`;
}

export function executableName(target: Target): string {
  return target.os === "windows" ? `${PROGRAM}.exe` : PROGRAM;
}

/** What the target's `PMR_TARGET` define says: the bun target without its `bun-` prefix. */
export function targetLabel(target: Target): string {
  return target.bun.replace(/^bun-/, "");
}

export interface ArchiveEntry {
  /** The path inside the archive. */
  name: string;
  /** The file to read. */
  path: string;
  executable: boolean;
}

/** Every archive holds the executable, `LICENSE`, `README.md` and `THIRD-PARTY-NOTICES.txt` (spec §13.4). */
export function archiveEntries(
  target: Target,
  executable: string,
  root: string,
): ArchiveEntry[] {
  return [
    { name: executableName(target), path: executable, executable: true },
    ...["LICENSE", "README.md", "THIRD-PARTY-NOTICES.txt"].map((name) => ({
      name,
      path: join(root, name),
      executable: false,
    })),
  ];
}

// --- Zip writer ---

const EPOCH_DOS_DATE = (1980 - 1980) * 512 + 1 * 32 + 1;

/**
 * A zip with every file deflated, the Unix mode in the external attributes (so `unzip` keeps the executable bit on
 * macOS) and a fixed timestamp, so the same inputs give the same bytes.
 */
export function zipBytes(
  files: { name: string; data: Uint8Array; executable: boolean }[],
): Uint8Array {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.from(file.data);
    const packed = deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(EPOCH_DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, packed);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE((3 << 8) | 20, 4); // made by Unix
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(0, 12);
    entry.writeUInt16LE(EPOCH_DOS_DATE, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(
      ((0o100000 | (file.executable ? 0o755 : 0o644)) << 16) >>> 0,
      38,
    );
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += local.length + name.length + packed.length;
  }
  const centralSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}

// --- Building ---

export interface ArchiveOptions {
  target: Target;
  executable: string;
  version: string;
  outDir: string;
  /** The folder holding `LICENSE`, `README.md` and `THIRD-PARTY-NOTICES.txt`. */
  root: string;
}

/** Builds one archive and returns its path. A missing input fails and names the file. */
export function buildArchive(options: ArchiveOptions): string {
  const { target, executable, version, outDir, root } = options;
  const entries = archiveEntries(target, executable, root);
  for (const entry of entries) {
    if (!existsSync(entry.path)) {
      throw new Error(
        `Can't build ${archiveName(version, target)}: ${entry.path} is missing.${
          basename(entry.path) === "THIRD-PARTY-NOTICES.txt"
            ? " Run `bun run notices` first."
            : ""
        }`,
      );
    }
  }
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, archiveName(version, target));
  if (target.ext === "zip") {
    writeFileSync(
      out,
      zipBytes(
        entries.map((e) => ({
          name: e.name,
          data: readFileSync(e.path),
          executable: e.executable,
        })),
      ),
    );
    return out;
  }
  // GNU tar with a fixed order, owner and time, so the same inputs give the same archive. The stage keeps the names flat.
  const stage = mkdtempSync(join(tmpdir(), "pmr-archive-"));
  try {
    for (const e of entries) {
      copyFileSync(e.path, join(stage, e.name));
      chmodSync(join(stage, e.name), e.executable ? 0o755 : 0o644);
    }
    const tarPath = `${out}.tar`;
    const result = spawnSync(
      "tar",
      [
        "--sort=name",
        "--mtime=@0",
        "--owner=0",
        "--group=0",
        "--numeric-owner",
        "-cf",
        tarPath,
        "-C",
        stage,
        ...entries.map((e) => e.name),
      ],
      { encoding: "utf8", env: { ...process.env, LC_ALL: "C" } },
    );
    if (result.status !== 0) {
      throw new Error(`tar failed: ${result.stderr || result.error?.message}`);
    }
    writeFileSync(out, Bun.gzipSync(readFileSync(tarPath)));
    rmSync(tarPath);
    return out;
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

/**
 * Lists every file in `dir` that `SHA256SUMS` should carry, in name order: archives and `.lua` bridges.
 * `listed` holds names already in the file. The Bun and tinycc source archives are `.tar.gz` and arrive with their lines from `lgpl-sources.ts build`.
 */
export function releaseFiles(
  dir: string,
  listed: ReadonlySet<string> = new Set(),
): string[] {
  return readdirSync(dir)
    .filter((n) => /\.(zip|tar\.gz|lua)$/.test(n) && !listed.has(n))
    .sort();
}

// --- Command line ---

const USAGE = `Usage:
  bun scripts/release-archive.ts archive --target <bun-target> --exe <file> --version <version> --out <dir> [--root <dir>]
  bun scripts/release-archive.ts sums --dir <dir> [--file <SHA256SUMS>]
  bun scripts/release-archive.ts bridges --out <dir>
  bun scripts/release-archive.ts targets [ubuntu|macos]
  bun scripts/release-archive.ts label --target <bun-target>`;

function option(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

export async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args;
  try {
    if (command === "archive") {
      const targetName = option(rest, "--target");
      const exe = option(rest, "--exe");
      const version = option(rest, "--version");
      const out = option(rest, "--out");
      if (!targetName || !exe || !version || !out) {
        console.error(USAGE);
        return 2;
      }
      console.log(
        buildArchive({
          target: findTarget(targetName),
          executable: resolve(exe),
          version,
          outDir: resolve(out),
          root: resolve(option(rest, "--root") ?? "."),
        }),
      );
      return 0;
    }
    if (command === "sums") {
      const dir = option(rest, "--dir");
      if (!dir) {
        console.error(USAGE);
        return 2;
      }
      const file = resolve(option(rest, "--file") ?? join(dir, "SHA256SUMS"));
      const listed = parseSums(
        existsSync(file) ? readFileSync(file, "utf8") : "",
      );
      const lines = [];
      for (const name of releaseFiles(resolve(dir), new Set(listed.keys()))) {
        lines.push({ name, hash: await sha256File(join(resolve(dir), name)) });
      }
      appendSums(file, lines);
      console.log(`Listed ${lines.length} files in ${file}.`);
      return 0;
    }
    if (command === "bridges") {
      const out = option(rest, "--out");
      if (!out) {
        console.error(USAGE);
        return 2;
      }
      // The release copies carry the default endpoints. The running program regenerates them for the user's own settings.
      const bridges = await generateBridges({
        mgba: DEFAULT_SETTINGS.adapters.mgba,
      });
      mkdirSync(resolve(out), { recursive: true });
      for (const name of BRIDGE_NAMES) {
        const file = join(resolve(out), `${name}.lua`);
        writeFileSync(file, bridges[name]);
        console.log(file);
      }
      return 0;
    }
    if (command === "targets") {
      const builder = rest[0];
      for (const t of TARGETS) {
        if (!builder || t.builder === builder) console.log(t.bun);
      }
      return 0;
    }
    if (command === "label") {
      const targetName = option(rest, "--target");
      if (!targetName) {
        console.error(USAGE);
        return 2;
      }
      console.log(targetLabel(findTarget(targetName)));
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
  process.exit(await main(process.argv.slice(2)));
}
