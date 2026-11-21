import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TARGETS } from "./release-archive";

const text = readFileSync(
  join(import.meta.dir, "../.github/workflows/release.yml"),
  "utf8",
);

interface Row {
  target?: string;
  runner?: string;
  ext?: string;
}

describe("release.yml", () => {
  test("every third-party action is pinned to a full commit SHA", () => {
    const uses = [...text.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map(
      (m) => m[1] ?? "",
    );
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
  });
  test("it triggers on version tags only, never v1-lua", () => {
    expect(text).toContain('tags: ["v[0-9]+.[0-9]+.[0-9]+*"]');
  });
  test("the matrices match the target table", () => {
    const workflow = Bun.YAML.parse(text) as {
      jobs: Record<string, { strategy: { matrix: { include: Row[] } } }>;
    };
    const build = workflow.jobs.build?.strategy.matrix.include ?? [];
    const smoke = workflow.jobs.smoke?.strategy.matrix.include ?? [];
    expect(build.map((r) => r.target)).toEqual(TARGETS.map((t) => t.bun));
    expect(smoke.map((r) => [r.runner, r.ext])).toEqual(
      TARGETS.map((t) => [t.smokeRunner, t.ext]),
    );
  });
  test("only a tag push creates a release, and a dry run uploads artifacts", () => {
    const create = text.indexOf("Create draft release");
    expect(text.slice(create, create + 120)).toContain(
      "needs.ref.outputs.dry_run == 'false'",
    );
    expect(text.match(/gh release create/g)).toHaveLength(1);
    expect(text).toContain("--draft");
    expect(text).toContain("name: release-draft");
  });
  test("the body steps run in order: ref check, signature evidence, LGPL lines", () => {
    const a = text.indexOf("scripts/check-release-ref.ts body");
    const b = text.indexOf("scripts/release-body.ts body.md");
    const c = text.indexOf("scripts/lgpl-sources.ts body body.md");
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(text.indexOf("scripts/check-release-ref.ts check")).toBeLessThan(a);
  });
  test("the coverage guard runs before the body steps", () => {
    const guard = text.indexOf("bun scripts/coverage.ts --check");
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(
      text.indexOf("scripts/check-release-ref.ts body"),
    );
  });
  test("the build runs notices before compiling", () => {
    expect(text.indexOf("bun run notices")).toBeLessThan(
      text.indexOf("scripts/build-exe.ts"),
    );
  });
});

describe("the body chain", () => {
  test("a body ends up with the changelog, the evidence, the coverage lists and the LGPL lines", () => {
    const dir = mkdtempSync(join(tmpdir(), "release-chain-"));
    try {
      const body = join(dir, "body.md");
      const run = (...args: string[]) => {
        const r = Bun.spawnSync(["bun", ...args], {
          cwd: join(import.meta.dir, ".."),
        });
        expect(r.exitCode, r.stderr.toString()).toBe(0);
      };
      run(
        "scripts/check-release-ref.ts",
        "body",
        "--tag",
        "v2.0.0-alpha.0",
        "--repo",
        "atendev/pokemon-memory-reader",
        "--out",
        body,
        "--dry-run",
      );
      run("scripts/release-body.ts", body);
      run("scripts/lgpl-sources.ts", "body", body, "--tag", "v2.0.0-alpha.0");
      const out = readFileSync(body, "utf8");
      expect(out).toContain("Dry run build of v2.0.0-alpha.0");
      expect(out).toContain("SmartScreen");
      expect(out).toContain("### Signature evidence");
      expect(out).toContain("### Fixture coverage");
      expect(out).toContain("#### Tier 2 gaps");
      expect(out).toContain("### Source for the LGPL libraries");
      writeFileSync(join(dir, "done"), "");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
