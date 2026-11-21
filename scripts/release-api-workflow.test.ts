import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRef } from "./check-release-ref";

const root = join(import.meta.dir, "..");
const text = readFileSync(
  join(root, ".github/workflows/release-api.yml"),
  "utf8",
);
const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");

interface Job {
  if?: string;
  needs?: string | string[];
  permissions?: Record<string, string>;
  steps: { name?: string; run?: string; env?: Record<string, string> }[];
}
const workflow = Bun.YAML.parse(text) as {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: Record<string, Job>;
};

function publishRuns(): string[] {
  return Object.values(workflow.jobs).flatMap((job) =>
    job.steps
      .map((step) => step.run ?? "")
      .filter((run) => /npm publish/.test(run)),
  );
}

describe("release-api.yml", () => {
  test("every third-party action is pinned to a full commit SHA", () => {
    const uses = [...text.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map(
      (m) => m[1] ?? "",
    );
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
  });
  test("it triggers on api-v tags only, so v tags never reach it", () => {
    const push = workflow.on.push as { tags: string[] };
    expect(push.tags).toEqual(["api-v[0-9]+.[0-9]+.[0-9]+*"]);
    expect(Object.keys(workflow.on).sort()).toEqual([
      "pull_request",
      "push",
      "workflow_dispatch",
    ]);
  });
  test("the ref check runs the shared script for the api kind and gates every other job", () => {
    expect(text).toMatch(/check-release-ref\.ts check .*--kind api/);
    expect(workflow.jobs.package?.needs).toBe("ref");
    expect(workflow.jobs.publish?.needs).toEqual(["ref", "package"]);
  });
  test("the package job runs the same checks as the ci api-package job", () => {
    for (const command of [
      "bunx publint pack/*.tgz",
      "bunx attw pack/*.tgz --profile esm-only",
      "bun scripts/api-consumer-smoke.ts pack/*.tgz",
    ]) {
      expect(text).toContain(command);
      expect(ci).toContain(command);
    }
  });
  test("the dry run and the real publish are separate steps, and only the dry run has --dry-run", () => {
    const runs = publishRuns();
    expect(runs).toHaveLength(2);
    const dry = runs.filter((run) => run.includes("--dry-run"));
    const real = runs.filter((run) => !run.includes("--dry-run"));
    expect(dry).toHaveLength(1);
    expect(real).toHaveLength(1);
    expect(real[0]).toContain("--provenance");
    expect(dry[0]).not.toContain("--provenance");
  });
  test("the real publish sits in a job that runs on a tag push only", () => {
    const job = workflow.jobs.publish;
    expect(job?.if).toBe("needs.ref.outputs.dry_run == 'false'");
    const real = job?.steps.filter(
      (step) => step.run?.includes("npm publish") ?? false,
    );
    expect(real).toHaveLength(1);
    expect(
      workflow.jobs.package?.steps.some((s) => s.run?.includes("--dry-run")),
    ).toBe(true);
    expect(
      workflow.jobs.package?.steps.some((s) =>
        /npm publish(?!.*--dry-run)/.test(s.run ?? ""),
      ),
    ).toBe(false);
  });
  test("it holds no token: no secrets, and OIDC permission on the publish job only", () => {
    expect(text).not.toContain("secrets.");
    expect(text).not.toContain("NODE_AUTH_TOKEN");
    expect(text).not.toContain("NPM_TOKEN");
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflow.jobs.publish?.permissions?.["id-token"]).toBe("write");
    for (const name of ["ref", "package"]) {
      expect(workflow.jobs[name]?.permissions).toBeUndefined();
    }
  });
  test("it uses npm 11.5.1, and a prerelease goes to next and a stable version to latest", () => {
    expect(text.match(/npm install --global npm@11\.5\.1/g)).toHaveLength(2);
    expect(
      Object.values(workflow.jobs).some((job) =>
        job.steps.some((step) => /bun publish/.test(step.run ?? "")),
      ),
    ).toBe(false);
    const env = text.match(/DIST_TAG: (.+)/g) ?? [];
    expect(env).toHaveLength(2);
    for (const line of env) {
      expect(line).toContain(
        "needs.ref.outputs.prerelease == 'true' && 'next' || 'latest'",
      );
    }
  });
  test("the release body is built from the changelog before the publish job can start", () => {
    const steps = workflow.jobs.package?.steps ?? [];
    const body = steps.find((s) => s.name === "Release body");
    expect(body?.run).toContain("check-release-ref.ts body");
    expect(body?.run).toContain("--kind api");
    expect(workflow.jobs.publish?.needs).toContain("package");
    expect(text.match(/gh release create/g)).toHaveLength(1);
  });
  test("a real run fails on a tag whose changelog section is missing, and a dry run builds a placeholder", () => {
    const body = (...extra: string[]) =>
      Bun.spawnSync(
        [
          "bun",
          "scripts/check-release-ref.ts",
          "body",
          "--tag",
          "api-v9.9.9-test.1",
          "--kind",
          "api",
          "--repo",
          "a/b",
          "--notes",
          "api/release-notes.md",
          "--out",
          join(tmpdir(), "release-api-body-test.md"),
          ...extra,
        ],
        { cwd: root },
      );
    const real = body();
    expect(real.exitCode).toBe(1);
    expect(real.stderr.toString()).toContain("api/CHANGELOG.md has no section");
    expect(body("--dry-run").exitCode).toBe(0);
  });
});

describe("the ref rules the workflow relies on", () => {
  const facts = {
    tag: "api-v2.0.0",
    kind: "api" as const,
    packageVersion: "2.0.0",
    onMain: false,
    branchExists: true,
    onBranch: true,
    prereleaseBranch: null,
  };
  test("a stable api tag from any ref but main fails", () => {
    expect(checkRef(facts)).toHaveLength(1);
    expect(
      checkRef({ ...facts, prereleaseBranch: "release-branch" }),
    ).not.toEqual([]);
    expect(checkRef({ ...facts, onMain: true })).toEqual([]);
  });
});
