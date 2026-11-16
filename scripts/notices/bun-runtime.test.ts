import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface Component {
  name: string;
  version: string;
  spdx: string;
  kind: string;
  source: string;
  targets: string[];
  texts: string[];
  blockedUntilAmendment?: boolean;
}
interface Manifest {
  bunVersion: string;
  sourceTag: string;
  sourceCommit: string;
  targets: string[];
  components: Component[];
}

const dir = import.meta.dir;
const manifest: Manifest = JSON.parse(
  readFileSync(join(dir, "bun-runtime.json"), "utf8"),
);
const rootPackage: { packageManager: string } = JSON.parse(
  readFileSync(join(dir, "../../package.json"), "utf8"),
);

/** The Bun version `packageManager` names, or null when it isn't `bun@<version>`. */
export function pinnedBunVersion(packageManager: string): string | null {
  return /^bun@(\d+\.\d+\.\d+)$/.exec(packageManager)?.[1] ?? null;
}

/** A message for each way the manifest and the pin can disagree, empty when they match. */
export function pinProblems(
  packageManager: string,
  manifestVersion: string,
): string[] {
  const pinned = pinnedBunVersion(packageManager);
  if (pinned === null)
    return [`packageManager "${packageManager}" is not bun@<version>`];
  if (pinned !== manifestVersion) {
    return [
      `packageManager pins Bun ${pinned} but bun-runtime.json is for Bun ${manifestVersion}; redo the manifest for ${pinned}`,
    ];
  }
  return [];
}

describe("bun-runtime.json pin", () => {
  test("matches the packageManager Bun version", () => {
    expect(
      pinProblems(rootPackage.packageManager, manifest.bunVersion),
    ).toEqual([]);
  });

  test("source tag names the same version", () => {
    expect(manifest.sourceTag).toBe(`bun-v${manifest.bunVersion}`);
  });

  test("fails when packageManager moves to another Bun version", () => {
    expect(pinProblems("bun@1.4.3", manifest.bunVersion)).toHaveLength(1);
    expect(pinProblems("bun@1.4.3", "1.4.3")).toEqual([]);
    expect(pinProblems("npm@10.0.0", manifest.bunVersion)).toHaveLength(1);
  });
});

describe("bun-runtime.json components", () => {
  const targets = new Set(manifest.targets);

  test("each entry is unique, sorted and complete", () => {
    const keys = manifest.components.map((c) => `${c.name}@${c.version}`);
    expect(new Set(keys).size).toBe(keys.length);
    const lower = (c: Component) => c.name.toLowerCase();
    const sorted = [...manifest.components].sort((a, b) => {
      if (lower(a) !== lower(b)) return lower(a) < lower(b) ? -1 : 1;
      return a.version < b.version ? -1 : a.version > b.version ? 1 : 0;
    });
    expect(manifest.components.map((c) => `${c.name}@${c.version}`)).toEqual(
      sorted.map((c) => `${c.name}@${c.version}`),
    );
    for (const c of manifest.components) {
      expect(c.spdx.trim(), `${c.name} spdx`).not.toBe("");
      expect(
        c.spdx,
        `${c.name} spdx is not a legacy slash expression`,
      ).not.toContain("/");
      expect(c.source, `${c.name} source`).toMatch(/^https:\/\//);
      expect(c.targets.length, `${c.name} targets`).toBeGreaterThan(0);
      for (const t of c.targets)
        expect(targets.has(t), `${c.name} target ${t}`).toBe(true);
    }
  });

  test("every entry has a non-empty vendored license text that exists", () => {
    for (const c of manifest.components) {
      expect(c.texts.length, `${c.name}@${c.version} texts`).toBeGreaterThan(0);
      for (const t of c.texts) {
        const path = join(dir, t);
        expect(existsSync(path), `${t} exists`).toBe(true);
        expect(
          readFileSync(path, "utf8").trim().length,
          `${t} is not empty`,
        ).toBeGreaterThan(40);
      }
    }
  });

  test("covers the components 027's research names", () => {
    const names = new Set(manifest.components.map((c) => c.name));
    for (const n of [
      "bun",
      "WebKit",
      "boringssl",
      "tinycc",
      "icu",
      "sqlite",
      "libarchive",
      "libjpeg-turbo",
      "cssparser",
      "selectors",
      "dtoa-short",
      "lol_html",
      "mozilla-ca-certificates",
    ]) {
      expect(names.has(n), n).toBe(true);
    }
  });

  test("entries that need an amendment are flagged, not passed off as accepted", () => {
    const blocked = manifest.components
      .filter((c) => c.blockedUntilAmendment)
      .map((c) => c.name);
    expect(blocked.sort()).toEqual(["bun_clap", "domain-browser"]);
  });
});
