import { describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  bunPinProblems,
  checkExpression,
  collectNotices,
  compareEntries,
  EMBEDDED_DEV_PACKAGES,
  EXCEPTIONS,
  type NoticesOptions,
  type Overrides,
  PERMISSIVE_TIER,
  RUNTIME_ENTRY_EXCEPTIONS,
  RUNTIME_TIER,
  renderNotices,
  repoOptions,
  run,
} from "./notices";

const FIXTURES = join(import.meta.dir, "notices/fixtures");

function fixtureOptions(
  name: string,
  extra: Partial<NoticesOptions> = {},
): NoticesOptions {
  const dir = join(FIXTURES, name);
  return {
    rootDir: dir,
    roots: ["."],
    manifestPath: null,
    overrides: {},
    noticesDir: dir,
    embeddedDevPackages: [],
    runtimeEntryExceptions: [],
    lockfilePath: null,
    packageManager: "bun@1.4.2",
    modulesDirName: "fixture_modules",
    ...extra,
  };
}

function capture() {
  const lines: { level: string; message: string }[] = [];
  return {
    lines,
    out: {
      log: (message: string) => lines.push({ level: "log", message }),
      warn: (message: string) => lines.push({ level: "warn", message }),
      error: (message: string) => lines.push({ level: "error", message }),
    },
  };
}

describe("tiers", () => {
  test("the permissive tier is exactly the eight IDs of amendment 027", () => {
    expect([...PERMISSIVE_TIER]).toEqual([
      "MIT",
      "ISC",
      "0BSD",
      "BSD-2-Clause",
      "BSD-3-Clause",
      "Apache-2.0",
      "Zlib",
      "Unicode-3.0",
    ]);
  });

  test("the runtime tier adds exactly six IDs", () => {
    expect(RUNTIME_TIER.filter((id) => !PERMISSIVE_TIER.includes(id))).toEqual([
      "LGPL-2.0-or-later",
      "LGPL-2.1-or-later",
      "MPL-2.0",
      "IJG",
      "blessing",
      "LicenseRef-PublicDomain",
    ]);
    expect(RUNTIME_TIER.slice(0, PERMISSIVE_TIER.length)).toEqual([
      ...PERMISSIVE_TIER,
    ]);
  });

  test("LLVM-exception is the only allowed exception", () => {
    expect([...EXCEPTIONS]).toEqual(["LLVM-exception"]);
  });

  test("the one runtime entry exception is domain-browser@4.23.0 under amendment 044", () => {
    expect([...RUNTIME_ENTRY_EXCEPTIONS]).toEqual([
      {
        entry: "domain-browser@4.23.0",
        spdx: "Artistic-2.0",
        amendment: "amendment 044",
        note: "Accepted under amendment 044. Bun's LICENSE.md lists domain-browser as MIT. Versions up to 4.22.0 were MIT, but 4.23.0, the version Bun bundles, is Artistic-2.0, and its own LICENSE.md below governs.",
      },
    ]);
    for (const e of RUNTIME_ENTRY_EXCEPTIONS) {
      expect(PERMISSIVE_TIER).not.toContain(e.spdx);
      expect(RUNTIME_TIER).not.toContain(e.spdx);
    }
  });

  test("no dev dependency is embedded yet", () => {
    expect([...EMBEDDED_DEV_PACKAGES]).toEqual([]);
  });
});

describe("checkExpression", () => {
  test("allows each permissive ID", () => {
    for (const id of PERMISSIVE_TIER) {
      expect(checkExpression(id, "permissive")).toEqual({ ok: true });
    }
  });

  test("rejects a disallowed license with its ID in the reason", () => {
    const verdict = checkExpression("GPL-3.0-only", "permissive");
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("GPL-3.0-only");
  });

  test("OR passes through one allowed branch, AND needs every term", () => {
    expect(
      checkExpression("BSD-3-Clause OR GPL-2.0-only", "permissive").ok,
    ).toBe(true);
    expect(
      checkExpression(
        "MIT OR Artistic-1.0-Perl OR GPL-1.0-or-later",
        "permissive",
      ).ok,
    ).toBe(true);
    expect(checkExpression("MIT AND GPL-3.0-only", "permissive").ok).toBe(
      false,
    );
    expect(
      checkExpression("(MIT OR GPL-3.0-only) AND ISC", "permissive").ok,
    ).toBe(true);
    expect(
      checkExpression("MIT OR GPL-3.0-only AND GPL-2.0-only", "permissive").ok,
    ).toBe(true);
  });

  test("LLVM-exception passes only with an allowed base", () => {
    expect(
      checkExpression("Apache-2.0 WITH LLVM-exception", "permissive").ok,
    ).toBe(true);
    expect(
      checkExpression("GPL-3.0-only WITH LLVM-exception", "permissive").ok,
    ).toBe(false);
    expect(
      checkExpression("MIT WITH Classpath-exception-2.0", "permissive").ok,
    ).toBe(false);
  });

  test("matches IDs and operators case-insensitively", () => {
    expect(checkExpression("mit", "permissive").ok).toBe(true);
    expect(
      checkExpression("apache-2.0 with llvm-exception", "permissive").ok,
    ).toBe(true);
    expect(
      checkExpression("bsd-3-clause or gpl-2.0-only", "permissive").ok,
    ).toBe(true);
  });

  test("reads + as -or-later and never reads -only that way", () => {
    expect(checkExpression("LGPL-2.0+", "runtime").ok).toBe(true);
    expect(checkExpression("LGPL-2.1+", "runtime").ok).toBe(true);
    expect(checkExpression("LGPL-2.1-only", "runtime").ok).toBe(false);
    expect(checkExpression("LGPL-2.0-only", "runtime").ok).toBe(false);
    expect(checkExpression("LGPL-3.0+", "runtime").ok).toBe(false);
    expect(checkExpression("MIT+", "runtime").ok).toBe(false);
  });

  test("runtime-only IDs fail the permissive tier and pass the runtime tier", () => {
    for (const id of [
      "LGPL-2.1-or-later",
      "MPL-2.0",
      "IJG",
      "blessing",
      "LicenseRef-PublicDomain",
    ]) {
      expect(checkExpression(id, "permissive").ok, id).toBe(false);
      expect(checkExpression(id, "runtime").ok, id).toBe(true);
    }
  });

  test("only the one LicenseRef passes", () => {
    expect(checkExpression("LicenseRef-Other", "runtime").ok).toBe(false);
  });

  test("an OR branch that passes only in the runtime tier does not pass the permissive one", () => {
    const expression = "MPL-1.1 OR GPL-2.0-or-later OR LGPL-2.1-or-later";
    expect(checkExpression(expression, "runtime").ok).toBe(true);
    expect(checkExpression(expression, "permissive").ok).toBe(false);
  });

  test("excluded IDs fail in both tiers", () => {
    for (const id of [
      "MIT-0",
      "BSL-1.0",
      "Unlicense",
      "CC0-1.0",
      "Python-2.0",
      "LGPL-3.0-or-later",
      "GPL-3.0-or-later",
      "AGPL-3.0-only",
      "WTFPL",
      "CC-BY-4.0",
      "BlueOak-1.0.0",
      "Artistic-2.0",
    ]) {
      expect(checkExpression(id, "runtime").ok, id).toBe(false);
    }
  });

  test("nothing is normalised: legacy and free-text strings fail", () => {
    for (const text of [
      "BSD",
      "Apache 2.0",
      "UNLICENSED",
      "SEE LICENSE IN LICENSE.txt",
      "MIT/Apache-2.0",
      "",
      "GPL",
    ]) {
      const verdict = checkExpression(text, "permissive");
      expect(verdict.ok, text).toBe(false);
    }
  });
});

describe("package fixtures", () => {
  test("allowed licenses pass with their texts", () => {
    const { entries, problems } = collectNotices(fixtureOptions("allowed"));
    expect(problems).toEqual([]);
    expect(entries.map((e) => `${e.name}@${e.version}`)).toEqual([
      "apache-pkg@2.0.0",
      "llvm-pkg@1.0.0",
      "lower-pkg@1.0.0",
      "mit-pkg@1.0.0",
      "nested-pkg@1.0.0",
      "or-pkg@1.0.0",
    ]);
    const mit = entries.find((e) => e.name === "mit-pkg");
    expect(mit?.texts[0]?.text).toContain("MIT License");
  });

  test("an Apache-2.0 package's NOTICE file is copied too", () => {
    const { entries } = collectNotices(fixtureOptions("allowed"));
    const files = entries
      .find((e) => e.name === "apache-pkg")
      ?.texts.map((t) => t.file);
    expect(files).toEqual(["LICENSE", "NOTICE"]);
  });

  test("LLVM-exception passes in an npm package's license", () => {
    const { entries, problems } = collectNotices(fixtureOptions("allowed"));
    expect(problems).toEqual([]);
    expect(entries.find((e) => e.name === "llvm-pkg")?.spdx).toBe(
      "Apache-2.0 WITH LLVM-exception",
    );
  });

  test("a disallowed license fails and names the package", () => {
    const { problems } = collectNotices(fixtureOptions("disallowed"));
    const has = (key: string, text: string) =>
      expect(
        problems.find((p) => p.startsWith(`${key}`)),
        key,
      ).toContain(text);
    has("gpl-pkg@1.0.0", "GPL-3.0-only");
    has("and-pkg@1.0.0", "GPL-3.0-only");
    has("exception-pkg@1.0.0", "Classpath-exception-2.0");
    has("runtime-only-pkg@1.0.0", "outside the permissive tier");
    has("plus-pkg@1.0.0", "LGPL-2.0-or-later");
    has("unlicense-pkg@1.0.0", "Unlicense");
  });

  test("non-SPDX, missing, legacy and object license fields fail", () => {
    const { problems } = collectNotices(fixtureOptions("disallowed"));
    const has = (key: string, text: string) =>
      expect(
        problems.find((p) => p.startsWith(`${key}`)),
        key,
      ).toContain(text);
    has("bsd-word-pkg@1.0.0", "not a valid SPDX expression");
    has("spaced-pkg@1.0.0", "not a valid SPDX expression");
    has("unlicensed-pkg@1.0.0", "not a valid SPDX expression");
    has("see-pkg@1.0.0", "not a valid SPDX expression");
    has("no-license-pkg@1.0.0", 'no "license" field');
    has("legacy-pkg@1.0.0", 'legacy "licenses" array');
    has("object-pkg@1.0.0", "not an SPDX string");
  });

  test("every package in the disallowed fixture fails and none is listed", () => {
    const { entries, problems } = collectNotices(fixtureOptions("disallowed"));
    expect(entries).toEqual([]);
    expect(problems).toHaveLength(13);
  });

  test("a package with no license text fails, and a README does not count", () => {
    const { entries, problems } = collectNotices(
      fixtureOptions("missing-text"),
    );
    expect(entries).toEqual([]);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain("no-text-pkg@1.0.0 has no license text");
    expect(problems[1]).toContain("readme-only-pkg@1.0.0 has no license text");
  });

  test("an override supplies the license and text for one name@version", () => {
    const overrides = JSON.parse(
      readFileSync(join(FIXTURES, "override/overrides.json"), "utf8"),
    ) as Overrides;
    const without = collectNotices(fixtureOptions("override"));
    expect(without.problems).toHaveLength(1);

    const { entries, problems } = collectNotices(
      fixtureOptions("override", { overrides }),
    );
    expect(problems).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.spdx).toBe("MIT");
    expect(entries[0]?.texts[0]?.text).toContain("MIT License");
  });

  test("an override for another version does not apply", () => {
    const overrides: Overrides = {
      "odd-pkg@3.0.0": { spdx: "MIT", reason: "x", text: "package:TERMS.txt" },
    };
    const { problems } = collectNotices(
      fixtureOptions("override", { overrides }),
    );
    expect(problems.some((p) => p.includes("odd-pkg@3.1.0"))).toBe(true);
    expect(problems.some((p) => p.includes("odd-pkg@3.0.0 is stale"))).toBe(
      true,
    );
  });

  test("a stale override fails", () => {
    const overrides: Overrides = {
      "odd-pkg@3.1.0": { spdx: "MIT", reason: "x", text: "package:TERMS.txt" },
      "gone-pkg@1.0.0": { spdx: "MIT", reason: "x", text: "package:LICENSE" },
    };
    const { problems } = collectNotices(
      fixtureOptions("override", { overrides }),
    );
    expect(problems).toEqual([
      "Override gone-pkg@1.0.0 is stale: that package is not in the dependency closure.",
    ]);
  });

  test("an override whose text path does not exist fails", () => {
    const overrides: Overrides = {
      "odd-pkg@3.1.0": { spdx: "MIT", reason: "x", text: "texts/nope.txt" },
    };
    const { problems } = collectNotices(
      fixtureOptions("override", { overrides }),
    );
    expect(problems).toEqual([
      "Override odd-pkg@3.1.0 points at a license text that is missing or empty: texts/nope.txt.",
    ]);
  });

  test("an override expression outside the tier fails", () => {
    const overrides: Overrides = {
      "odd-pkg@3.1.0": {
        spdx: "GPL-3.0-only",
        reason: "x",
        text: "package:TERMS.txt",
      },
    };
    const { problems } = collectNotices(
      fixtureOptions("override", { overrides }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("(override)");
    expect(problems[0]).toContain("GPL-3.0-only");
  });

  test("an override with an empty field fails", () => {
    const overrides: Overrides = {
      "odd-pkg@3.1.0": { spdx: "MIT", reason: "", text: "package:TERMS.txt" },
    };
    const { problems } = collectNotices(
      fixtureOptions("override", { overrides }),
    );
    expect(problems).toEqual([
      "Override odd-pkg@3.1.0 needs a non-empty spdx, reason and text.",
    ]);
  });

  test("a vendored override text resolves against the notices directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "notices-"));
    try {
      mkdirSync(join(dir, "texts"));
      writeFileSync(join(dir, "texts/odd.txt"), "Vendored license text.\n");
      const overrides: Overrides = {
        "odd-pkg@3.1.0": { spdx: "MIT", reason: "x", text: "texts/odd.txt" },
      };
      const { entries, problems } = collectNotices(
        fixtureOptions("override", { overrides, noticesDir: dir }),
      );
      expect(problems).toEqual([]);
      expect(entries[0]?.texts[0]?.text).toBe("Vendored license text.\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the walk", () => {
  function workspace(): string {
    const dir = mkdtempSync(join(tmpdir(), "notices-walk-"));
    const write = (path: string, content: unknown) => {
      mkdirSync(join(dir, path, ".."), { recursive: true });
      writeFileSync(
        join(dir, path),
        typeof content === "string" ? content : JSON.stringify(content),
      );
    };
    write("package.json", { name: "root", private: true });
    write("app/package.json", {
      name: "app",
      dependencies: { "@scope/lib": "workspace:*" },
    });
    write("lib/package.json", {
      name: "@scope/lib",
      version: "1.0.0",
      dependencies: { dep: "1.0.0" },
    });
    write("node_modules/dep/package.json", {
      name: "dep",
      version: "1.0.0",
      license: "MIT",
    });
    write("node_modules/dep/LICENSE", "Dep license text\n");
    mkdirSync(join(dir, "app/node_modules/@scope"), { recursive: true });
    symlinkSync(join(dir, "lib"), join(dir, "app/node_modules/@scope/lib"));
    return dir;
  }
  const options = (
    dir: string,
    extra: Partial<NoticesOptions> = {},
  ): NoticesOptions => ({
    ...fixtureOptions("allowed"),
    rootDir: dir,
    roots: ["app"],
    noticesDir: dir,
    modulesDirName: "node_modules",
    ...extra,
  });

  test("skips a workspace package but still walks its dependencies", () => {
    const dir = workspace();
    try {
      const { entries, problems } = collectNotices(options(dir));
      expect(problems).toEqual([]);
      expect(entries.map((e) => `${e.name}@${e.version}`)).toEqual([
        "dep@1.0.0",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a registry package with the first-party scope is still checked", () => {
    const dir = workspace();
    try {
      rmSync(join(dir, "app/node_modules/@scope/lib"));
      mkdirSync(join(dir, "app/node_modules/@scope/lib/"), { recursive: true });
      writeFileSync(
        join(dir, "app/node_modules/@scope/lib/package.json"),
        JSON.stringify({
          name: "@scope/lib",
          version: "9.9.9",
          license: "GPL-3.0-only",
        }),
      );
      const { problems } = collectNotices(options(dir));
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain("@scope/lib@9.9.9");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a missing required dependency fails and a missing optional one does not", () => {
    const dir = workspace();
    try {
      writeFileSync(
        join(dir, "lib/package.json"),
        JSON.stringify({
          name: "@scope/lib",
          version: "1.0.0",
          dependencies: { dep: "1.0.0", absent: "1.0.0" },
          optionalDependencies: { "absent-optional": "1.0.0" },
        }),
      );
      const { problems } = collectNotices(options(dir));
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain("absent");
      expect(problems[0]).toContain("not installed");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("EMBEDDED_DEV_PACKAGES entries are walked and must be in the lockfile", () => {
    const dir = workspace();
    try {
      writeFileSync(
        join(dir, "bun.lock"),
        '{\n  "lockfileVersion": 1,\n  "packages": {\n    "dep": ["dep@1.0.0", "", {}, "sha"],\n  },\n}\n',
      );
      const lockfilePath = join(dir, "bun.lock");
      const listed = collectNotices(
        options(dir, { roots: [], embeddedDevPackages: ["dep"], lockfilePath }),
      );
      expect(listed.problems).toEqual([]);
      expect(listed.entries.map((e) => e.name)).toEqual(["dep"]);

      const missing = collectNotices(
        options(dir, {
          roots: [],
          embeddedDevPackages: ["tailwindcss"],
          lockfilePath,
        }),
      );
      expect(missing.problems).toContain(
        "EMBEDDED_DEV_PACKAGES names tailwindcss, which is not in the lockfile.",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Bun runtime manifest", () => {
  const manifestPath = join(FIXTURES, "runtime/bun-runtime.json");
  const runtime = () =>
    collectNotices(
      fixtureOptions("runtime", {
        roots: [],
        manifestPath,
        noticesDir: join(FIXTURES, "runtime"),
      }),
    );

  test("the runtime tier accepts LLVM-exception, the LGPL and blessing", () => {
    const { entries, problems } = runtime();
    expect(problems).toEqual([]);
    expect(entries.map((e) => e.name)).toEqual([
      "jsc",
      "libc++abi",
      "odd-clap",
      "sqlite",
    ]);
  });

  test("an entry outside the runtime tier is reported as blocked, not accepted", () => {
    const { blocked } = runtime();
    expect(blocked).toEqual(["odd-clap@1.0.0"]);
  });

  test("an unflagged entry outside the runtime tier fails", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.components[3].blockedUntilAmendment = undefined;
    const dir = mkdtempSync(join(tmpdir(), "notices-manifest-"));
    try {
      writeFileSync(join(dir, "bun-runtime.json"), JSON.stringify(manifest));
      mkdirSync(join(dir, "texts"));
      writeFileSync(join(dir, "texts/apache.txt"), "text\n");
      writeFileSync(join(dir, "texts/mit.txt"), "text\n");
      const { problems, blocked } = collectNotices(
        fixtureOptions("runtime", {
          roots: [],
          manifestPath: join(dir, "bun-runtime.json"),
          noticesDir: dir,
        }),
      );
      expect(blocked).toEqual([]);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain("odd-clap@1.0.0");
      expect(problems[0]).toContain("Unlicense");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a stale blockedUntilAmendment flag fails", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.components[1].blockedUntilAmendment = true;
    const dir = mkdtempSync(join(tmpdir(), "notices-manifest-"));
    try {
      writeFileSync(join(dir, "bun-runtime.json"), JSON.stringify(manifest));
      mkdirSync(join(dir, "texts"));
      writeFileSync(join(dir, "texts/apache.txt"), "text\n");
      writeFileSync(join(dir, "texts/mit.txt"), "text\n");
      const { problems } = collectNotices(
        fixtureOptions("runtime", {
          roots: [],
          manifestPath: join(dir, "bun-runtime.json"),
          noticesDir: dir,
        }),
      );
      expect(problems).toEqual([
        "Bun runtime component jsc@1.0.0 now passes the runtime tier. Remove its blockedUntilAmendment flag.",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a missing license text fails", () => {
    const { problems } = collectNotices(
      fixtureOptions("runtime", {
        roots: [],
        manifestPath,
        noticesDir: join(FIXTURES, "missing-text"),
      }),
    );
    expect(problems.filter((p) => p.includes("missing or empty"))).toHaveLength(
      4,
    );
  });

  test("a Bun version that differs from packageManager fails", () => {
    expect(bunPinProblems("bun@1.4.2", "1.4.2")).toEqual([]);
    expect(bunPinProblems("bun@1.4.3", "1.4.2")).toHaveLength(1);
    expect(bunPinProblems("npm@10.0.0", "1.4.2")).toHaveLength(1);
    expect(bunPinProblems(null, "1.4.2")).toHaveLength(1);
    const { problems } = collectNotices(
      fixtureOptions("runtime", {
        roots: [],
        manifestPath,
        noticesDir: join(FIXTURES, "runtime"),
        packageManager: "bun@1.4.3",
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("Bun 1.4.3");
  });
});

describe("runtime entry exceptions", () => {
  const manifestPath = join(FIXTURES, "runtime/bun-runtime.json");
  const exception = {
    entry: "artistic-thing@2.0.0",
    spdx: "Artistic-2.0",
    amendment: "amendment 000",
    note: "Accepted under amendment 000 for tests.",
  };

  /** Runs the notices over a copy of the runtime fixture manifest with one extra Artistic-2.0 component. */
  function withManifest<T>(
    version: string,
    check: (path: string, dir: string) => T,
  ): T {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.components = manifest.components.filter(
      (c: { name: string }) => c.name !== "odd-clap",
    );
    manifest.components.push({
      name: "artistic-thing",
      version,
      spdx: "Artistic-2.0",
      source: "https://example.com/artistic-thing.tgz",
      targets: manifest.targets,
      texts: ["texts/mit.txt"],
    });
    const dir = mkdtempSync(join(tmpdir(), "notices-exception-"));
    try {
      writeFileSync(join(dir, "bun-runtime.json"), JSON.stringify(manifest));
      mkdirSync(join(dir, "texts"));
      writeFileSync(join(dir, "texts/apache.txt"), "text\n");
      writeFileSync(join(dir, "texts/mit.txt"), "text\n");
      return check(join(dir, "bun-runtime.json"), dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  const collect = (
    path: string,
    dir: string,
    runtimeEntryExceptions: NoticesOptions["runtimeEntryExceptions"],
  ) =>
    collectNotices(
      fixtureOptions("runtime", {
        roots: [],
        manifestPath: path,
        noticesDir: dir,
        runtimeEntryExceptions,
      }),
    );

  test("checkExpression accepts the extra ID only when it is passed", () => {
    expect(checkExpression("Artistic-2.0", "runtime").ok).toBe(false);
    expect(
      checkExpression("Artistic-2.0", "runtime", ["Artistic-2.0"]).ok,
    ).toBe(true);
    expect(checkExpression("Artistic-2.0", "permissive").ok).toBe(false);
    const both = checkExpression("Artistic-2.0 AND GPL-2.0-only", "runtime", [
      "Artistic-2.0",
    ]);
    expect(both.ok).toBe(false);
  });

  test("an entry on the exact name@version passes under its ID", () => {
    withManifest("2.0.0", (path, dir) => {
      const { problems, entries, blocked } = collect(path, dir, [exception]);
      expect(problems).toEqual([]);
      expect(blocked).toEqual([]);
      expect(entries.find((e) => e.name === "artistic-thing")?.note).toBe(
        exception.note,
      );
    });
  });

  test("without the exception the same entry fails the runtime tier", () => {
    withManifest("2.0.0", (path, dir) => {
      const { problems } = collect(path, dir, []);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain("artistic-thing@2.0.0");
      expect(problems[0]).toContain("Artistic-2.0");
    });
  });

  test("another version fails, and the exception is reported stale", () => {
    withManifest("2.0.1", (path, dir) => {
      const { problems } = collect(path, dir, [exception]);
      expect(problems).toHaveLength(2);
      expect(problems.some((p) => p.includes("artistic-thing@2.0.1"))).toBe(
        true,
      );
      expect(problems).toContain(
        "Runtime entry exception artistic-thing@2.0.0 is stale: that component is not in the Bun manifest.",
      );
    });
  });

  test("the rest of the expression still has to pass", () => {
    withManifest("2.0.0", (path, dir) => {
      const manifest = JSON.parse(readFileSync(path, "utf8"));
      const entry = manifest.components.find(
        (c: { name: string }) => c.name === "artistic-thing",
      );
      entry.spdx = "Artistic-2.0 AND GPL-2.0-only";
      writeFileSync(path, JSON.stringify(manifest));
      const { problems } = collect(path, dir, [exception]);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain("GPL-2.0-only");
    });
  });

  test("an npm closure entry with the same name@version never matches", () => {
    const failing = (runtimeEntryExceptions: readonly (typeof exception)[]) =>
      collectNotices(
        fixtureOptions("disallowed", { runtimeEntryExceptions }),
      ).problems.filter((p) => p.startsWith("gpl-pkg@1.0.0"));
    const without = failing([]);
    expect(without).toHaveLength(1);
    expect(
      failing([{ ...exception, entry: "gpl-pkg@1.0.0", spdx: "GPL-3.0-only" }]),
    ).toEqual(without);
  });

  test("an override with the same name@version never matches", () => {
    const base = JSON.parse(
      readFileSync(join(FIXTURES, "override/overrides.json"), "utf8"),
    ) as Overrides;
    const overrides: Overrides = Object.fromEntries(
      Object.entries(base).map(([key, o]) => [
        key,
        { ...o, spdx: "Artistic-2.0" },
      ]),
    );
    const { problems } = collectNotices(
      fixtureOptions("override", {
        overrides,
        runtimeEntryExceptions: Object.keys(overrides).map((entry) => ({
          ...exception,
          entry,
        })),
      }),
    );
    expect(problems.some((p) => p.includes("(override)"))).toBe(true);
    expect(problems.some((p) => p.includes("stale"))).toBe(false);
  });

  test("with no manifest, exceptions are not checked for staleness", () => {
    const { problems } = collectNotices(
      fixtureOptions("allowed", { runtimeEntryExceptions: [exception] }),
    );
    expect(problems).toEqual([]);
  });

  test("the notices print the note under the Source line", () => {
    withManifest("2.0.0", (path, dir) => {
      const { entries } = collect(path, dir, [exception]);
      const text = renderNotices(entries);
      expect(text).toContain(
        `artistic-thing 2.0.0\nLicense: Artistic-2.0\nSource: https://example.com/artistic-thing.tgz\n${exception.note}\n\n`,
      );
      expect(text).not.toContain(
        "jsc 1.0.0\nLicense: LGPL-2.1-or-later AND BSD-2-Clause\nSource: https://example.com/jsc\nAccepted",
      );
    });
  });

  test("a stale exception fails notices --check", () => {
    const { lines, out } = capture();
    const opts = fixtureOptions("runtime", {
      roots: [],
      manifestPath,
      noticesDir: join(FIXTURES, "runtime"),
      runtimeEntryExceptions: [exception],
    });
    expect(run(["--check"], opts, out)).toBe(1);
    expect(
      lines.some((l) => l.message.includes("artistic-thing@2.0.0 is stale")),
    ).toBe(true);
  });

  test("the repo's exception passes domain-browser@4.23.0 and prints its note", () => {
    const { entries, problems, blocked } = collectNotices(repoOptions());
    expect(problems).toEqual([]);
    expect(blocked).not.toContain("domain-browser@4.23.0");
    const entry = entries.find((e) => e.name === "domain-browser");
    expect(entry?.version).toBe("4.23.0");
    expect(entry?.source).toBe(
      "https://registry.npmjs.org/domain-browser/-/domain-browser-4.23.0.tgz",
    );
    expect(renderNotices(entries)).toContain(
      `Source: https://registry.npmjs.org/domain-browser/-/domain-browser-4.23.0.tgz\n${RUNTIME_ENTRY_EXCEPTIONS[0]?.note}\n`,
    );
  });

  test("dropping the repo's exception makes domain-browser fail", () => {
    const { problems } = collectNotices({
      ...repoOptions(),
      runtimeEntryExceptions: [],
    });
    expect(problems.some((p) => p.includes("domain-browser@4.23.0"))).toBe(
      true,
    );
  });
});

describe("renderNotices", () => {
  test("lists each entry with its text, sorted, and names builds that only some targets include", () => {
    const { entries } = collectNotices(
      fixtureOptions("runtime", {
        roots: [],
        manifestPath: join(FIXTURES, "runtime/bun-runtime.json"),
        noticesDir: join(FIXTURES, "runtime"),
      }),
    );
    const text = renderNotices(entries);
    expect(text.indexOf("jsc 1.0.0")).toBeLessThan(
      text.indexOf("libc++abi 19.1.0"),
    );
    expect(text).toContain(
      "sqlite 3.53.2\nLicense: blessing\nIncluded in: Linux and Windows builds",
    );
    expect(text).not.toContain(
      "jsc 1.0.0\nLicense: LGPL-2.1-or-later AND BSD-2-Clause\nIncluded in",
    );
    expect(text).toContain("MIT License");
    expect(renderNotices(entries)).toBe(text);
  });

  test("sorts versions numerically", () => {
    const entry = (version: string) => ({
      name: "pkg",
      version,
      spdx: "MIT",
      origin: "npm" as const,
      builds: null,
      source: null,
      note: null,
      texts: [{ file: "LICENSE", text: "t" }],
    });
    const sorted = [entry("10.0.0"), entry("9.0.0"), entry("9.10.0")].sort(
      compareEntries,
    );
    expect(sorted.map((e) => e.version)).toEqual(["9.0.0", "9.10.0", "10.0.0"]);
  });

  test("does not deduplicate identical texts", () => {
    const { entries } = collectNotices(fixtureOptions("allowed"));
    const text = renderNotices(entries);
    expect(text.split("MIT License").length - 1).toBeGreaterThanOrEqual(3);
  });
});

describe("the repo", () => {
  test("passes against the installed dependencies and the checked-in Bun manifest", () => {
    const { entries, problems, blocked } = collectNotices(repoOptions());
    expect(problems).toEqual([]);
    expect(blocked).toEqual(["bun_clap@1.4.2"]);
    const npm = entries.filter((e) => e.origin === "npm").map((e) => e.name);
    for (const name of ["zod", "hono", "react", "react-dom"])
      expect(npm).toContain(name);
    expect(npm.some((n) => n.startsWith("@pokemon-memory-reader/"))).toBe(
      false,
    );
    expect(npm.some((n) => n.startsWith("spdx-") || n === "typescript")).toBe(
      false,
    );
  });
});

describe("the command line", () => {
  test("--check passes on the repo and writes no file", () => {
    const { lines, out } = capture();
    const target = join(tmpdir(), "notices-should-not-exist.txt");
    expect(run(["--check", "--out", target], repoOptions(), out)).toBe(0);
    expect(
      lines.some(
        (l) => l.level === "warn" && l.message.includes("bun_clap@1.4.2"),
      ),
    ).toBe(true);
    expect(lines.at(-1)?.message).toContain("Notices check passed");
    expect(() => readFileSync(target)).toThrow();
  });

  test("--check fails on a disallowed dependency", () => {
    const { lines, out } = capture();
    expect(run(["--check"], fixtureOptions("disallowed"), out)).toBe(1);
    expect(
      lines.some(
        (l) => l.level === "error" && l.message.includes("gpl-pkg@1.0.0"),
      ),
    ).toBe(true);
    expect(lines.at(-1)?.message).toBe(
      "Notices check failed with 13 problems.",
    );
  });

  test("--check fails on a missing license text", () => {
    const { out } = capture();
    expect(run(["--check"], fixtureOptions("missing-text"), out)).toBe(1);
  });

  test("--check --strict fails while a Bun entry is blocked", () => {
    const { lines, out } = capture();
    const opts = fixtureOptions("runtime", {
      roots: [],
      manifestPath: join(FIXTURES, "runtime/bun-runtime.json"),
      noticesDir: join(FIXTURES, "runtime"),
    });
    expect(run(["--check"], opts, out)).toBe(0);
    expect(run(["--check", "--strict"], opts, out)).toBe(1);
    expect(
      lines.some((l) => l.message.includes("odd-clap@1.0.0 is blocked")),
    ).toBe(true);
  });

  test("the generating mode writes the notices file when nothing is blocked", () => {
    const dir = mkdtempSync(join(tmpdir(), "notices-out-"));
    try {
      const target = join(dir, "THIRD-PARTY-NOTICES.txt");
      const { out } = capture();
      expect(run(["--out", target], fixtureOptions("allowed"), out)).toBe(0);
      const text = readFileSync(target, "utf8");
      expect(text.startsWith("THIRD-PARTY NOTICES")).toBe(true);
      expect(text).toContain("apache-pkg 2.0.0");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the generating mode refuses to write while a Bun entry is blocked", () => {
    const dir = mkdtempSync(join(tmpdir(), "notices-out-"));
    try {
      const target = join(dir, "THIRD-PARTY-NOTICES.txt");
      const { out } = capture();
      const opts = fixtureOptions("runtime", {
        roots: [],
        manifestPath: join(FIXTURES, "runtime/bun-runtime.json"),
        noticesDir: join(FIXTURES, "runtime"),
      });
      expect(run(["--out", target], opts, out)).toBe(1);
      expect(() => readFileSync(target)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an unknown flag prints the usage and exits 2", () => {
    const { lines, out } = capture();
    expect(run(["--nope"], fixtureOptions("allowed"), out)).toBe(2);
    expect(lines[0]?.message).toContain("Usage:");
  });
});
