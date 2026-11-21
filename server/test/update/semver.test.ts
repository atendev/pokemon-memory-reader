import { expect, test } from "bun:test";
import { compareSemver, parseSemver } from "../../src/update/semver";

const cmp = (a: string, b: string) =>
  Math.sign(compareSemver(parseSemver(a) as never, parseSemver(b) as never));

test("versions order by number, with rc.2 before rc.10", () => {
  expect(cmp("2.0.0", "1.9.9")).toBe(1);
  expect(cmp("2.1.0", "2.0.9")).toBe(1);
  expect(cmp("2.0.0-rc.2", "2.0.0-rc.10")).toBe(-1);
  expect(cmp("2.0.0-beta.1", "2.0.0-rc.1")).toBe(-1);
  expect(cmp("2.0.0-rc.1", "2.0.0-rc.1.1")).toBe(-1);
  expect(cmp("2.0.0-1", "2.0.0-alpha")).toBe(-1);
});

test("a stable version outranks its prereleases, and build metadata is ignored", () => {
  expect(cmp("2.0.0", "2.0.0-rc.9")).toBe(1);
  expect(cmp("2.0.0+abc", "2.0.0+def")).toBe(0);
  expect(cmp("2.0.0-alpha.0", "2.0.0-alpha.0")).toBe(0);
});

test.each(["2.0", "v2.0.0", "02.0.0", "2.0.0-", "2.0.0-01", "x.y.z", ""])(
  "%j is not a version",
  (text) => {
    expect(parseSemver(text)).toBeNull();
  },
);
