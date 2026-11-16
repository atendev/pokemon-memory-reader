import { expect, test } from "bun:test";
import pkg from "../package.json";

test("the exports map points only at built files", () => {
  const targets = Object.entries(pkg.exports).flatMap(([subpath, target]) =>
    Object.values(target).map((file) => [subpath, file] as const),
  );
  expect(Object.keys(pkg.exports).sort()).toEqual([
    "./client",
    "./schemas",
    "./types",
  ]);
  for (const [subpath, file] of targets) {
    expect(file, subpath).toMatch(/^\.\/dist\/[a-z]+\.(js|d\.ts)$/);
  }
});

test("the published files are the build, the README and the license", () => {
  expect(pkg.files).toEqual(["dist", "README.md", "LICENSE"]);
});
