import { describe, expect, test } from "bun:test";
import tailwind from "bun-plugin-tailwind";
import { buildConfig } from "./build-exe";

describe("buildConfig", () => {
  test("always runs the Tailwind plugin, which the command line build skips", () => {
    expect(buildConfig({ outfile: "out/x" }).plugins).toEqual([tailwind]);
  });

  test("maps a target and the two defines", () => {
    const config = buildConfig({
      outfile: "out/x",
      target: "bun-linux-x64-baseline",
      label: "linux-x64-baseline",
      commit: "abc1234",
    });
    expect(config.compile).toEqual({
      outfile: "out/x",
      target: "bun-linux-x64-baseline",
    });
    expect(config.define).toEqual({
      PMR_TARGET: '"linux-x64-baseline"',
      PMR_COMMIT: '"abc1234"',
    });
  });

  test("maps an executable path and leaves the defines out when unset", () => {
    const config = buildConfig({
      outfile: "out/x",
      executablePath: "/bin/bun",
    });
    expect(config.compile).toEqual({
      outfile: "out/x",
      executablePath: "/bin/bun",
    });
    expect(config.define).toEqual({});
  });

  test("refuses a target together with an executable path", () => {
    expect(() =>
      buildConfig({
        outfile: "o",
        target: "bun-linux-x64",
        executablePath: "/b",
      }),
    ).toThrow("cannot be used together");
  });
});
