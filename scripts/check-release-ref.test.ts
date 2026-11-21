import { describe, expect, test } from "bun:test";
import {
  buildBody,
  changelogSection,
  checkRef,
  lintBodyLinks,
  PRERELEASE_BRANCH,
  parseTag,
  type RefFacts,
} from "./check-release-ref";

const BRANCH = "wayfinder/v2-build-master";
function facts(over: Partial<RefFacts>): RefFacts {
  return {
    tag: "v2.0.0-beta.1",
    kind: "app",
    packageVersion: "2.0.0-beta.1",
    onMain: false,
    branchExists: true,
    onBranch: true,
    prereleaseBranch: BRANCH,
    ...over,
  };
}

describe("parseTag", () => {
  test("reads app and api tags and tells prereleases from stable ones", () => {
    expect(parseTag("v2.0.0", "app")).toEqual({
      version: "2.0.0",
      prerelease: false,
    });
    expect(parseTag("v2.0.0-rc.1", "app")).toEqual({
      version: "2.0.0-rc.1",
      prerelease: true,
    });
    expect(parseTag("api-v2.0.0-beta.2", "api")).toEqual({
      version: "2.0.0-beta.2",
      prerelease: true,
    });
  });
  test("refuses tags that are not semver or have the wrong prefix", () => {
    for (const tag of [
      "v1-lua",
      "v2.0",
      "v2.0.0+build",
      "v02.0.0",
      "v2.0.0-",
      "api-v2.0.0",
    ]) {
      expect(typeof parseTag(tag, "app")).toBe("string");
    }
    expect(typeof parseTag("v2.0.0", "api")).toBe("string");
  });
});

describe("checkRef rule table", () => {
  test("a stable tag passes only from main with the constant gone", () => {
    const stable = {
      tag: "v2.0.0",
      packageVersion: "2.0.0",
      prereleaseBranch: null,
    };
    expect(checkRef(facts({ ...stable, onMain: true }))).toEqual([]);
    expect(
      checkRef(facts({ ...stable, onMain: false, onBranch: true })),
    ).toHaveLength(1);
  });
  test("a stable tag fails while PRERELEASE_BRANCH is set, and says which constant", () => {
    const problems = checkRef(
      facts({ tag: "v2.0.0", packageVersion: "2.0.0", onMain: true }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("PRERELEASE_BRANCH");
  });
  test("a stable tag from the prerelease branch only is refused", () => {
    expect(
      checkRef(
        facts({
          tag: "v2.0.0",
          packageVersion: "2.0.0",
          onMain: false,
          onBranch: true,
        }),
      ).length,
    ).toBeGreaterThan(0);
  });
  test("a prerelease passes from main, from the branch, and fails from neither", () => {
    expect(checkRef(facts({ onMain: true, onBranch: false }))).toEqual([]);
    expect(checkRef(facts({ onMain: false, onBranch: true }))).toEqual([]);
    expect(checkRef(facts({ onMain: false, onBranch: false }))).toHaveLength(1);
  });
  test("a prerelease needs main when the constant is empty", () => {
    expect(checkRef(facts({ prereleaseBranch: null, onMain: true }))).toEqual(
      [],
    );
    expect(
      checkRef(
        facts({ prereleaseBranch: null, onMain: false, onBranch: true }),
      ),
    ).toHaveLength(1);
  });
  test("a branch missing on origin fails even when the commit is on main", () => {
    const problems = checkRef(
      facts({ onMain: true, branchExists: false, onBranch: false }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("doesn't exist on origin");
  });
  test("a version that differs from package.json fails, for app and api", () => {
    expect(
      checkRef(facts({ onMain: true, packageVersion: "2.0.0-beta.2" }))[0],
    ).toContain("server/package.json");
    const api = facts({
      tag: "api-v2.0.0-beta.1",
      kind: "api",
      onMain: true,
      packageVersion: "1.0.0",
    });
    expect(checkRef(api)[0]).toContain("api/package.json");
  });
  test("the constant is the integration branch today", () => {
    expect(PRERELEASE_BRANCH).toBe(BRANCH);
  });
});

describe("release body", () => {
  const repo = "atendev/pokemon-memory-reader";
  test("links pinned to the tag pass, others fail", () => {
    const ok = `[a](https://github.com/${repo}/blob/v2.0.0-beta.1/docs/x.md) [b](https://github.com/${repo}/tree/v2.0.0-beta.1/docs)`;
    expect(lintBodyLinks(ok, repo, "v2.0.0-beta.1")).toEqual([]);
    for (const ref of ["main", "wayfinder/v2-build-master", "v2.0.0-alpha.1"]) {
      expect(
        lintBodyLinks(
          `https://github.com/${repo}/blob/${ref}/README.md`,
          repo,
          "v2.0.0-beta.1",
        ),
      ).toHaveLength(1);
    }
    expect(
      lintBodyLinks(
        "https://github.com/other/repo/blob/main/x",
        repo,
        "v2.0.0-beta.1",
      ),
    ).toEqual([]);
  });
  test("changelogSection finds a bracketed or plain heading and stops at the next", () => {
    const log =
      "# Changelog\n\n## [2.0.0-beta.1] - 2026-12-01\n\nNew things.\n\n## 2.0.0-alpha.0\n\nOld.\n";
    expect(changelogSection(log, "2.0.0-beta.1")).toBe("New things.");
    expect(changelogSection(log, "2.0.0-alpha.0")).toBe("Old.");
    expect(changelogSection(log, "2.0.0")).toBeNull();
  });
  const base = {
    tag: "v2.0.0-beta.1",
    kind: "app" as const,
    repo,
    notes: "### Running this build\n\n- note",
    dryRun: false,
  };
  test("a real release needs the changelog section, a dry run gets a placeholder", () => {
    expect(() => buildBody({ ...base, changelog: null })).toThrow(
      "has no section for 2.0.0-beta.1",
    );
    expect(buildBody({ ...base, changelog: null, dryRun: true })).toContain(
      "Dry run build of v2.0.0-beta.1",
    );
    const body = buildBody({
      ...base,
      changelog: "## 2.0.0-beta.1\n\nFirst beta.",
    });
    expect(body).toBe("First beta.\n\n### Running this build\n\n- note\n");
  });
  test("a bad link in the section fails the body", () => {
    const changelog = `## 2.0.0-beta.1\n\nSee https://github.com/${repo}/blob/main/README.md`;
    expect(() => buildBody({ ...base, changelog })).toThrow(
      "isn't pinned to the tag",
    );
  });
});
