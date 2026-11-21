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
import { inflateRawSync } from "node:zlib";
import {
  archiveName,
  buildArchive,
  executableName,
  findTarget,
  TARGETS,
  targetLabel,
  zipBytes,
} from "./release-archive";

const dir = mkdtempSync(join(tmpdir(), "release-archive-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Reads a zip back through its central directory. */
function readZip(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  const entries: { name: string; mode: number; data: string }[] = [];
  const count = b.readUInt16LE(b.length - 22 + 10);
  let at = b.readUInt32LE(b.length - 22 + 16);
  for (let i = 0; i < count; i++) {
    const nameLen = b.readUInt16LE(at + 28);
    const local = b.readUInt32LE(at + 42);
    const size = b.readUInt32LE(at + 20);
    const start =
      local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    entries.push({
      name: b.toString("utf8", at + 46, at + 46 + nameLen),
      mode: (b.readUInt32LE(at + 38) >>> 16) & 0o777,
      data: inflateRawSync(b.subarray(start, start + size)).toString("utf8"),
    });
    at += 46 + nameLen;
  }
  return entries;
}

function inputs() {
  const root = join(dir, "root");
  mkdirSync(root, { recursive: true });
  for (const n of ["LICENSE", "README.md", "THIRD-PARTY-NOTICES.txt"])
    writeFileSync(join(root, n), `${n} text`);
  const exe = join(dir, "built-exe");
  writeFileSync(exe, "binary");
  return { root, exe };
}

describe("targets", () => {
  test("lists the six targets of spec 13.1 with baseline x64", () => {
    expect(TARGETS.map((t) => t.bun).sort()).toEqual([
      "bun-darwin-arm64",
      "bun-darwin-x64-baseline",
      "bun-linux-arm64",
      "bun-linux-x64-baseline",
      "bun-windows-arm64",
      "bun-windows-x64-baseline",
    ]);
  });
  test("names archives and executables", () => {
    expect(
      archiveName("2.0.0-beta.1", findTarget("bun-linux-x64-baseline")),
    ).toBe("pokemon-memory-reader-v2.0.0-beta.1-linux-x64.tar.gz");
    expect(archiveName("2.0.0", findTarget("bun-darwin-arm64"))).toBe(
      "pokemon-memory-reader-v2.0.0-macos-arm64.zip",
    );
    expect(archiveName("2.0.0", findTarget("bun-windows-arm64"))).toBe(
      "pokemon-memory-reader-v2.0.0-windows-arm64.zip",
    );
    expect(executableName(findTarget("bun-windows-arm64"))).toBe(
      "pokemon-memory-reader.exe",
    );
    expect(targetLabel(findTarget("bun-linux-x64-baseline"))).toBe(
      "linux-x64-baseline",
    );
  });
  test("an unknown target fails and lists the known ones", () => {
    expect(() => findTarget("bun-plan9")).toThrow("Known targets");
  });
});

describe("buildArchive", () => {
  test("a zip holds the four files and keeps the executable bit", () => {
    const { root, exe } = inputs();
    const out = buildArchive({
      target: findTarget("bun-darwin-arm64"),
      executable: exe,
      version: "2.0.0-beta.1",
      outDir: join(dir, "out"),
      root,
    });
    const entries = readZip(readFileSync(out));
    expect(entries.map((e) => e.name)).toEqual([
      "pokemon-memory-reader",
      "LICENSE",
      "README.md",
      "THIRD-PARTY-NOTICES.txt",
    ]);
    expect(entries[0]?.mode).toBe(0o755);
    expect(entries[1]?.mode).toBe(0o644);
    expect(entries[0]?.data).toBe("binary");
  });
  test("the same inputs give the same zip bytes", () => {
    const a = zipBytes([
      { name: "a", data: Buffer.from("x"), executable: false },
    ]);
    const b = zipBytes([
      { name: "a", data: Buffer.from("x"), executable: false },
    ]);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
  test("a Windows zip names the executable with .exe", () => {
    const { root, exe } = inputs();
    const out = buildArchive({
      target: findTarget("bun-windows-x64-baseline"),
      executable: exe,
      version: "2.0.0",
      outDir: join(dir, "win"),
      root,
    });
    expect(readZip(readFileSync(out))[0]?.name).toBe(
      "pokemon-memory-reader.exe",
    );
  });
  test("a tar.gz keeps the executable bit", () => {
    const { root, exe } = inputs();
    const out = buildArchive({
      target: findTarget("bun-linux-x64-baseline"),
      executable: exe,
      version: "2.0.0",
      outDir: join(dir, "lin"),
      root,
    });
    const listing = Bun.spawnSync(["tar", "-tvzf", out]).stdout.toString();
    expect(listing).toMatch(/-rwx\S+ 0\/0 .*pokemon-memory-reader\n/);
    for (const n of ["LICENSE", "README.md", "THIRD-PARTY-NOTICES.txt"])
      expect(listing).toContain(n);
  });
  test("a missing notices file fails and says how to make it", () => {
    const { exe } = inputs();
    const empty = join(dir, "empty");
    mkdirSync(empty, { recursive: true });
    for (const n of ["LICENSE", "README.md"]) writeFileSync(join(empty, n), n);
    expect(() =>
      buildArchive({
        target: findTarget("bun-darwin-arm64"),
        executable: exe,
        version: "1",
        outDir: join(dir, "x"),
        root: empty,
      }),
    ).toThrow("Run `bun run notices` first");
  });
});
