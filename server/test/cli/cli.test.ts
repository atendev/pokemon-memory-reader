import { expect, test } from "bun:test";
import { DEFAULT_HOST, DEFAULT_PORT } from "@pokemon-memory-reader/api/client";
import { parseArgs } from "../../src/cli";

test("no flags run with the defaults", () => {
  expect(parseArgs([])).toEqual({
    kind: "run",
    options: {
      port: DEFAULT_PORT,
      host: DEFAULT_HOST,
      openBrowser: true,
      dataDir: null,
      debug: false,
    },
  });
});

test("every flag is read", () => {
  expect(
    parseArgs([
      "--port",
      "8080",
      "--host",
      "0.0.0.0",
      "--no-browser",
      "--data-dir",
      "/tmp/x",
      "--debug",
    ]),
  ).toEqual({
    kind: "run",
    options: {
      port: 8080,
      host: "0.0.0.0",
      openBrowser: false,
      dataDir: "/tmp/x",
      debug: true,
    },
  });
});

test("--version and --help win over a run", () => {
  expect(parseArgs(["--version"])).toEqual({ kind: "version" });
  expect(parseArgs(["--no-browser", "--help"])).toEqual({ kind: "help" });
});

test.each([
  [["--port"], "--port needs"],
  [["--port", "0"], "--port needs"],
  [["--port", "65536"], "--port needs"],
  [["--port", "80x"], "--port needs"],
  [["--port", "--debug"], "--port needs"],
  [["--host"], "--host needs"],
  [["--data-dir"], "--data-dir needs"],
  [["--data-dir", ""], "--data-dir needs"],
  [["--nope"], "unknown option --nope"],
])("%j is an error", (argv, message) => {
  const command = parseArgs(argv);
  expect(command.kind).toBe("error");
  if (command.kind === "error") expect(command.message).toContain(message);
});
