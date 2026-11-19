import { afterAll, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  appendSums,
  bodySection,
  buildAll,
  buildArchive,
  checkAssets,
  checkOffline,
  checkOnline,
  MANIFEST_PATH,
  PART_BYTES,
  parseSums,
  partName,
  readPins,
  runCommand,
  type SourcePin,
  sha256File,
  splitIfLarge,
  type Upstream,
  withBodySection,
} from "./lgpl-sources";

// Under the gitignored `out/`, not /tmp, which can be RAM-backed. Every fixture is a few bytes.
const scratchRoot = join(import.meta.dir, "../out");
mkdirSync(scratchRoot, { recursive: true });
const dir = mkdtempSync(join(scratchRoot, "lgpl-sources-test-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const git = (cwd: string, ...args: string[]) =>
  runCommand(["git", "-C", cwd, ...args]).trim();

/** A local stand-in for github.com: one repo per pin, each with a single commit, plus `.git`-free content and a nested file. */
function makeUpstream(pins: SourcePin[]): { base: string; pins: SourcePin[] } {
  const root = mkdtempSync(join(dir, "upstream-"));
  const fixed = pins.map((pin) => {
    const repo = join(root, pin.repo);
    mkdirSync(join(repo, "src"), { recursive: true });
    runCommand(["git", "init", "-q", repo]);
    writeFileSync(join(repo, "README"), `${pin.id}\n`);
    writeFileSync(join(repo, "src/file.c"), `// ${pin.id}\n`);
    git(repo, "add", ".");
    git(
      repo,
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@example.com",
      "commit",
      "-q",
      "-m",
      "init",
    );
    return { ...pin, commit: git(repo, "rev-parse", "HEAD") };
  });
  return { base: `file://${root}`, pins: fixed };
}

const realPins = readPins();

describe("readPins", () => {
  test("reads Bun, tinycc and WebKit from the committed manifest", () => {
    expect(realPins.map((p) => p.id).sort()).toEqual([
      "bun",
      "tinycc",
      "webkit",
    ]);
    const byId = Object.fromEntries(realPins.map((p) => [p.id, p]));
    expect(byId.bun?.asset).toBe("bun-1.4.2-source.tar.gz");
    expect(byId.bun?.tag).toBe("bun-v1.4.2");
    expect(byId.webkit?.asset).toBe(
      `webkit-${byId.webkit?.commit.slice(0, 12)}-source.tar.xz`,
    );
    expect(byId.tinycc?.asset).toMatch(/^tinycc-[0-9a-f]{12}-source\.tar\.gz$/);
    for (const p of realPins) expect(p.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  test("an LGPL entry with no archive plan fails", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
    manifest.components.push({
      name: "libnew",
      version: "1",
      spdx: "LGPL-2.1-or-later",
      upstream: { repo: "x/libnew", commit: "a".repeat(40) },
    });
    const path = join(dir, "no-plan.json");
    writeFileSync(path, JSON.stringify(manifest));
    expect(() => readPins(path)).toThrow("no source archive plan");
  });

  test("a missing WebKit entry fails", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
    manifest.components = manifest.components.filter(
      (c: { name: string }) => c.name !== "WebKit",
    );
    const path = join(dir, "no-webkit.json");
    writeFileSync(path, JSON.stringify(manifest));
    expect(() => readPins(path)).toThrow("no LGPL entry for webkit");
  });

  test("a short commit fails", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
    manifest.sourceCommit = "744846f";
    const path = join(dir, "short.json");
    writeFileSync(path, JSON.stringify(manifest));
    expect(() => readPins(path)).toThrow("not a 40-character commit");
  });
});

describe("buildArchive and buildAll", () => {
  test("builds the three archives from upstream at the pinned commits", async () => {
    const { base, pins } = makeUpstream(realPins);
    const out = join(dir, "out");
    const sums = join(out, "SHA256SUMS");
    const files = await buildAll(pins, sums, { outDir: out, baseUrl: base });
    expect(files.map((f) => f.split("/").pop()).sort()).toEqual(
      pins.map((p) => p.asset).sort(),
    );
    const webkit = pins.find((p) => p.id === "webkit");
    const listing = runCommand(["tar", "-tf", join(out, webkit?.asset ?? "")]);
    const root = webkit?.asset.replace("-source.tar.xz", "");
    expect(listing).toContain(`${root}/README`);
    expect(listing).toContain(`${root}/src/file.c`);
    expect(listing).not.toContain(".git/");
    const listed = parseSums(readFileSync(sums, "utf8"));
    expect([...listed.keys()].sort()).toEqual(pins.map((p) => p.asset).sort());
    for (const [name, hash] of listed) {
      expect(await sha256File(join(out, name))).toBe(hash);
    }
  });

  test("two builds of the same commit give the same bytes", () => {
    const { base, pins } = makeUpstream(realPins);
    const pin = pins.find((p) => p.id === "tinycc") as SourcePin;
    const a = buildArchive(pin, { outDir: join(dir, "same-a"), baseUrl: base });
    const b = buildArchive(pin, { outDir: join(dir, "same-b"), baseUrl: base });
    expect(readFileSync(a).equals(readFileSync(b))).toBe(true);
  });

  test("two builds of the xz archive give the same bytes", () => {
    const { base, pins } = makeUpstream(realPins);
    const pin = pins.find((p) => p.id === "webkit") as SourcePin;
    const a = buildArchive(pin, { outDir: join(dir, "xz-a"), baseUrl: base });
    const b = buildArchive(pin, { outDir: join(dir, "xz-b"), baseUrl: base });
    expect(pin.asset.endsWith(".tar.xz")).toBe(true);
    expect(readFileSync(a).equals(readFileSync(b))).toBe(true);
  });

  test("a commit upstream doesn't have fails the build and leaves no archive", async () => {
    const { base, pins } = makeUpstream(realPins);
    const bad = pins.map((p) =>
      p.id === "webkit" ? { ...p, commit: "b".repeat(40) } : p,
    );
    const out = join(dir, "out-bad");
    await expect(
      buildAll(bad, join(out, "SHA256SUMS"), { outDir: out, baseUrl: base }),
    ).rejects.toThrow("failed with exit");
    expect(existsSync(join(out, "SHA256SUMS"))).toBe(false);
  });

  test("an unreachable upstream fails the build", async () => {
    const out = join(dir, "out-down");
    await expect(
      buildAll(realPins, join(out, "SHA256SUMS"), {
        outDir: out,
        baseUrl: `file://${join(dir, "nowhere")}`,
      }),
    ).rejects.toThrow("failed with exit");
  });

  test("a fetch that returns a different commit than the pin fails", () => {
    const { base, pins } = makeUpstream(realPins);
    const pin = pins.find((p) => p.id === "bun") as SourcePin;
    const run = (cmd: string[], opts?: Parameters<typeof runCommand>[1]) =>
      cmd.includes("rev-parse") ? `${"c".repeat(40)}\n` : runCommand(cmd, opts);
    expect(() =>
      buildArchive(pin, { outDir: join(dir, "wrong"), baseUrl: base, run }),
    ).toThrow(`fetched ${"c".repeat(40)} but the manifest pins`);
  });
});

describe("splitIfLarge", () => {
  test("an archive under the limit stays whole", () => {
    const file = join(dir, "small.tar.xz");
    writeFileSync(file, "x".repeat(100));
    expect(splitIfLarge(file, { splitAt: 200, partBytes: 50 })).toEqual([file]);
    expect(existsSync(file)).toBe(true);
  });

  test("an archive at the limit is split into numbered parts and the whole file goes", () => {
    const file = join(dir, "big.tar.xz");
    writeFileSync(file, "y".repeat(230));
    const parts = splitIfLarge(file, { splitAt: 230, partBytes: 100 });
    expect(parts).toEqual([`${file}.000`, `${file}.001`, `${file}.002`]);
    expect(existsSync(file)).toBe(false);
    expect(parts.map((p) => statSync(p).size)).toEqual([100, 100, 30]);
    expect(Buffer.concat(parts.map((p) => readFileSync(p))).toString()).toBe(
      "y".repeat(230),
    );
  });

  test("the real limits are 2 GiB and parts of 1900 MiB", () => {
    expect(PART_BYTES).toBe(1900 * 1024 * 1024);
    expect(PART_BYTES).toBeLessThan(2 * 1024 ** 3);
    expect(partName("a.tar.xz", 7)).toBe("a.tar.xz.007");
  });

  test("buildAll lists each part in the sums file", async () => {
    const { base, pins } = makeUpstream(realPins);
    const out = join(dir, "out-split");
    const sums = join(out, "SHA256SUMS");
    await buildAll(pins, sums, {
      outDir: out,
      baseUrl: base,
      splitAt: 1,
      partBytes: 200,
    });
    const listed = [...parseSums(readFileSync(sums, "utf8")).keys()];
    expect(listed.every((n) => /\.\d{3}$/.test(n))).toBe(true);
    expect(listed.length).toBe(readdirSync(out).length - 1);
    expect(listed).toContain(partName(pins[0]?.asset ?? "", 0));
  });
});

describe("appendSums", () => {
  test("appends after existing lines and refuses a name already listed", () => {
    const file = join(dir, "SHA256SUMS");
    writeFileSync(file, `${"a".repeat(64)}  app.zip`);
    appendSums(file, [{ name: "x.tar.gz", hash: "b".repeat(64) }]);
    expect(readFileSync(file, "utf8")).toBe(
      `${"a".repeat(64)}  app.zip\n${"b".repeat(64)}  x.tar.gz\n`,
    );
    expect(() =>
      appendSums(file, [{ name: "x.tar.gz", hash: "c".repeat(64) }]),
    ).toThrow("already lists x.tar.gz");
  });
});

describe("release body", () => {
  test("names the relink doc at the tag, each upstream link and each fetch line", () => {
    const text = bodySection(realPins, "v2.0.0-beta.1");
    expect(text).toContain("/blob/v2.0.0-beta.1/docs/lgpl-relinking.md");
    for (const p of realPins) {
      expect(text).toContain(
        `https://github.com/${p.repo}/tree/${p.tag ?? p.commit}`,
      );
      expect(text).toContain(
        `git fetch --depth 1 https://github.com/${p.repo} ${p.commit}`,
      );
    }
  });

  test("a second run fails instead of doubling the section", () => {
    const once = withBodySection("Notes", realPins, "v1");
    expect(once.startsWith("Notes\n\n### Source for the LGPL libraries")).toBe(
      true,
    );
    expect(() => withBodySection(once, realPins, "v1")).toThrow("already has");
  });
});

describe("checkOffline", () => {
  test("passes on the committed manifest, notices and relinking doc with no network", () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("network call in the offline check");
    }) as unknown as typeof fetch;
    try {
      expect(checkOffline()).toEqual([]);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test("fails when the doc names a different commit", () => {
    const doc = readFileSync(
      join(import.meta.dir, "../docs/lgpl-relinking.md"),
      "utf8",
    );
    const webkit = realPins.find((p) => p.id === "webkit") as SourcePin;
    const path = join(dir, "doc.md");
    writeFileSync(path, doc.replaceAll(webkit.commit, "0".repeat(40)));
    const problems = checkOffline(MANIFEST_PATH, path);
    expect(problems).toEqual([
      expect.stringContaining(`does not mention ${webkit.commit}`),
    ]);
  });

  test("fails when the doc is missing", () => {
    expect(checkOffline(MANIFEST_PATH, join(dir, "none.md"))).toContain(
      "docs/lgpl-relinking.md is missing.",
    );
  });

  test("fails when an LGPL entry lacks its notice fields", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
    for (const c of manifest.components) {
      if (c.name === "tinycc") delete c.copyright;
    }
    const path = join(dir, "no-copyright.json");
    writeFileSync(path, JSON.stringify(manifest));
    expect(checkOffline(path).join("\n")).toContain("has no copyright");
  });
});

function releaseFor(pins: SourcePin[], webkitParts = 0) {
  const assets = pins.flatMap((p) =>
    p.id === "webkit" && webkitParts > 0
      ? Array.from({ length: webkitParts }, (_, i) => ({
          name: partName(p.asset, i),
          size: i === webkitParts - 1 ? 1000 : PART_BYTES,
        }))
      : [{ name: p.asset, size: 5000 }],
  );
  const sums = assets.map((a) => `${"d".repeat(64)}  ${a.name}`).join("\n");
  const body = bodySection(pins, "v1");
  return { assets, sums, body };
}

const allResolve: Upstream = {
  commitExists: async () => true,
  tagCommit: async (_repo, _tag) =>
    realPins.find((p) => p.id === "bun")?.commit ?? null,
};

describe("checkOnline", () => {
  test("passes when every pin resolves and the release carries every asset", async () => {
    expect(
      await checkOnline(realPins, allResolve, releaseFor(realPins)),
    ).toEqual([]);
    expect(
      await checkOnline(realPins, allResolve, releaseFor(realPins, 3)),
    ).toEqual([]);
    expect(await checkOnline(realPins, allResolve)).toEqual([]);
  });

  test("fails when a pinned commit doesn't resolve", async () => {
    const upstream: Upstream = {
      ...allResolve,
      commitExists: async (repo) => repo !== "oven-sh/WebKit",
    };
    const problems = await checkOnline(realPins, upstream);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("does not exist in oven-sh/WebKit");
  });

  test("fails when the Bun tag is missing or points elsewhere", async () => {
    const gone = await checkOnline(realPins, {
      ...allResolve,
      tagCommit: async () => null,
    });
    expect(gone.join("\n")).toContain("tag bun-v1.4.2 does not exist");
    const moved = await checkOnline(realPins, {
      ...allResolve,
      tagCommit: async () => "e".repeat(40),
    });
    expect(moved.join("\n")).toContain("not the pinned");
  });

  test("a failed lookup is a problem, not a pass", async () => {
    const problems = await checkOnline(realPins, {
      ...allResolve,
      commitExists: async () => {
        throw new Error("GitHub answered 503.");
      },
    });
    expect(problems.join("\n")).toContain("GitHub answered 503.");
  });

  test("fails when a source asset is missing", async () => {
    const release = releaseFor(realPins);
    const tinycc = realPins.find((p) => p.id === "tinycc") as SourcePin;
    release.assets = release.assets.filter((a) => a.name !== tinycc.asset);
    const problems = await checkOnline(realPins, allResolve, release);
    expect(problems).toContain(
      `The release has no ${tinycc.asset} (tinycc source).`,
    );
  });

  test("fails when an asset isn't in SHA256SUMS", async () => {
    const release = releaseFor(realPins);
    const bun = realPins.find((p) => p.id === "bun") as SourcePin;
    release.sums = release.sums.replace(`  ${bun.asset}`, "  other.zip");
    expect(await checkOnline(realPins, allResolve, release)).toContain(
      `SHA256SUMS does not list ${bun.asset}.`,
    );
  });

  test("fails when the body lacks the upstream links", async () => {
    const release = { ...releaseFor(realPins), body: "Release notes" };
    const problems = await checkOnline(realPins, allResolve, release);
    expect(
      problems.some((p) =>
        p.startsWith(
          "The release body does not link https://github.com/oven-sh/WebKit/tree/",
        ),
      ),
    ).toBe(true);
    expect(problems).toContain(
      "The release body does not link docs/lgpl-relinking.md.",
    );
  });
});

describe("checkAssets WebKit parts", () => {
  const webkit = realPins.find((p) => p.id === "webkit") as SourcePin;
  const sums = (names: string[]) =>
    new Map(names.map((n) => [n, "d".repeat(64)]));

  test("a missing middle part fails", () => {
    const assets = [0, 2].map((i) => ({
      name: partName(webkit.asset, i),
      size: PART_BYTES,
    }));
    const problems = checkAssets(
      webkit,
      assets,
      sums(assets.map((a) => a.name)),
    );
    expect(problems.join("\n")).toContain("skip");
  });

  test("a part cut short before the last fails", () => {
    const assets = [
      { name: partName(webkit.asset, 0), size: PART_BYTES - 1 },
      { name: partName(webkit.asset, 1), size: 10 },
    ];
    const problems = checkAssets(
      webkit,
      assets,
      sums(assets.map((a) => a.name)),
    );
    expect(problems.join("\n")).toContain("cut short");
  });

  test("a single part, or whole and parts together, fail", () => {
    const one = [{ name: partName(webkit.asset, 0), size: 10 }];
    expect(
      checkAssets(webkit, one, sums([one[0]?.name ?? ""])).join("\n"),
    ).toContain("one part");
    const both = [
      { name: webkit.asset, size: 10 },
      { name: partName(webkit.asset, 0), size: 10 },
    ];
    expect(
      checkAssets(webkit, both, sums(both.map((a) => a.name))).join("\n"),
    ).toContain("whole and as parts");
  });

  test("a SHA256SUMS line for a part the release lacks fails", () => {
    const assets = [
      { name: partName(webkit.asset, 0), size: PART_BYTES },
      { name: partName(webkit.asset, 1), size: 10 },
    ];
    const listed = [...assets.map((a) => a.name), partName(webkit.asset, 2)];
    expect(checkAssets(webkit, assets, sums(listed))).toEqual([
      `SHA256SUMS lists ${partName(webkit.asset, 2)} but the release has no such asset.`,
    ]);
  });

  test("every extra SHA256SUMS line is reported, not just the first", () => {
    const assets = [
      { name: partName(webkit.asset, 0), size: PART_BYTES },
      { name: partName(webkit.asset, 1), size: 10 },
    ];
    const extra = [partName(webkit.asset, 2), partName(webkit.asset, 3)];
    expect(
      checkAssets(
        webkit,
        assets,
        sums([...assets.map((a) => a.name), ...extra]),
      ),
    ).toHaveLength(2);
  });

  test("a broken asset set gets its own message only, not one per sums line", () => {
    const both = [
      { name: webkit.asset, size: 10 },
      { name: partName(webkit.asset, 0), size: 10 },
    ];
    const problems = checkAssets(
      webkit,
      both,
      sums([...both.map((a) => a.name), partName(webkit.asset, 1)]),
    );
    expect(problems).toEqual([
      `${webkit.asset} is attached whole and as parts.`,
    ]);
  });

  test("sums lines for other assets are left alone", () => {
    const tinycc = realPins.find((p) => p.id === "tinycc") as SourcePin;
    const assets = [{ name: webkit.asset, size: 10 }];
    expect(
      checkAssets(
        webkit,
        assets,
        sums([webkit.asset, tinycc.asset, "app.zip"]),
      ),
    ).toEqual([]);
  });

  test("a part missing from SHA256SUMS fails", () => {
    const assets = [
      { name: partName(webkit.asset, 0), size: PART_BYTES },
      { name: partName(webkit.asset, 1), size: 10 },
    ];
    expect(checkAssets(webkit, assets, sums([assets[0]?.name ?? ""]))).toEqual([
      `SHA256SUMS does not list ${partName(webkit.asset, 1)}.`,
    ]);
  });
});
