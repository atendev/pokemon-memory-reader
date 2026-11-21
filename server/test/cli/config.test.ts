import { afterEach, beforeEach, expect, test } from "bun:test";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_SETTINGS } from "@pokemon-memory-reader/internal/config";
import {
  logConfigIssues,
  readConfigFile,
  resolveConfig,
} from "../../src/config";
import { resolvePaths } from "../../src/data-folder";
import { silentLog } from "../../src/log";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pmr-config-"));
});
afterEach(() => rm(root, { recursive: true, force: true }));

type Flags = Parameters<typeof resolveConfig>[1];
const NO_FLAGS: Flags = { port: null, host: null, openBrowser: null };
const paths = () =>
  resolvePaths({ platform: "linux", env: {}, dataDirFlag: root });

async function load(contents: string | null, flags = NO_FLAGS) {
  const p = paths();
  if (contents !== null) await writeFile(p.configFile, contents);
  return resolveConfig(await readConfigFile(p.configFile), flags, p);
}

test("a missing file means defaults and nothing is written", async () => {
  const config = await load(null);
  expect(config.file.exists).toBe(false);
  expect(config.applied()).toEqual(DEFAULT_SETTINGS);
  expect(config.writable).toBe(true);
  expect(config.sourceOf("port")).toBe("default");
  expect(await Bun.file(paths().configFile).exists()).toBe(false);
});

test("a valid file applies and its keys report the file as their source", async () => {
  const config = await load('{"port": 8000, "pollHz": 30}');
  expect(config.applied().port).toBe(8000);
  expect(config.applied().pollHz).toBe(30);
  expect(config.sourceOf("port")).toBe("file");
  expect(config.sourceOf("host")).toBe("default");
  expect(config.file.exists).toBe(true);
});

test("a malformed file runs on defaults, refuses saves and names the path in the log", async () => {
  const config = await load("{ nope");
  expect(config.applied()).toEqual(DEFAULT_SETTINGS);
  expect(config.writable).toBe(false);
  const lines: string[] = [];
  logConfigIssues(paths().configFile, config.file.issues, {
    ...silentLog,
    error: (m) => void lines.push(m),
  });
  expect(lines).toHaveLength(1);
  expect(lines[0]).toContain(paths().configFile);
});

test("a file that can't be read runs on defaults and refuses saves", async () => {
  // A directory in the file's place reads as an error that isn't ENOENT.
  const p = paths();
  await Bun.$`mkdir ${p.configFile}`.quiet();
  const file = await readConfigFile(p.configFile);
  expect(file.refusal).toBe("unreadable");
  expect(file.settings).toEqual(DEFAULT_SETTINGS);
  expect(file.exists).toBe(true);
});

test("a file with unknown keys loads, warns once and keeps them", async () => {
  const config = await load('{"port": 8000, "theme": "dark"}');
  expect(config.applied().port).toBe(8000);
  expect(config.file.unknown).toEqual({ theme: "dark" });
  expect(config.file.issues).toHaveLength(1);
  expect(config.writable).toBe(true);
});

test("a newer configVersion refuses saves", async () => {
  const config = await load('{"configVersion": 9, "port": 8000}');
  expect(config.applied().port).toBe(8000);
  expect(config.writable).toBe(false);
});

test("flags beat the file, which beats the defaults, and are never written back", async () => {
  const config = await load(
    '{"port": 8000, "host": "0.0.0.0", "openBrowser": true}',
    { port: 9000, host: null, openBrowser: false },
  );
  const applied = config.applied();
  expect(applied.port).toBe(9000);
  expect(applied.host).toBe("0.0.0.0");
  expect(applied.openBrowser).toBe(false);
  expect(config.sourceOf("port")).toBe("flag");
  expect(config.sourceOf("host")).toBe("file");
  expect(config.sourceOf("pollHz")).toBe("default");
  // The file still holds its own port, which a restart without the flag will use.
  expect(config.file.settings.port).toBe(8000);
  expect(config.pending()).toEqual(["port", "openBrowser"]);
});

test("a live setting changes at once and tells its listeners", async () => {
  const config = await load("{}");
  const seen: { changed: readonly string[]; hz: number }[] = [];
  config.onLive((settings, changed) =>
    seen.push({ changed, hz: settings.pollHz }),
  );
  const result = config.change({
    pollHz: 40,
    adapters: { mgba: { port: 9000 } },
  });
  expect(result).toEqual({ applied: ["adapters", "pollHz"], pending: [] });
  expect(config.applied().pollHz).toBe(40);
  expect(config.applied().adapters.mgba.port).toBe(9000);
  expect(seen).toEqual([{ changed: ["adapters", "pollHz"], hz: 40 }]);
  // Setting what is already applied changes nothing and stays quiet.
  expect(config.change({ pollHz: 40 }).applied).toEqual([]);
  expect(seen).toHaveLength(1);
});

test("a startup setting waits for a restart, and the viewer can see it pending", async () => {
  const config = await load('{"port": 8000}');
  const seen: unknown[] = [];
  config.onLive((_, changed) => seen.push(changed));
  const result = config.change({ port: 8100, host: "0.0.0.0" });
  expect(result).toEqual({ applied: [], pending: ["port", "host"] });
  expect(config.applied().port).toBe(8000);
  expect(config.applied().host).toBe("127.0.0.1");
  expect(config.pending()).toEqual(["port", "host"]);
  expect(seen).toEqual([]);
  // Putting the running value back clears the pending mark.
  expect(config.change({ port: 8000, host: "127.0.0.1" }).pending).toEqual([]);
});

test("a hand edit after startup is not seen: nothing watches the file", async () => {
  const config = await load('{"pollHz": 30}');
  await writeFile(paths().configFile, '{"pollHz": 50}');
  expect(config.applied().pollHz).toBe(30);
  const restarted = resolveConfig(
    await readConfigFile(paths().configFile),
    NO_FLAGS,
    paths(),
  );
  expect(restarted.applied().pollHz).toBe(50);
});

test("an unreadable file does not stop the program", async () => {
  if (process.getuid?.() === 0) return;
  const p = paths();
  await writeFile(p.configFile, "{}");
  await chmod(p.configFile, 0o000);
  const config = resolveConfig(await readConfigFile(p.configFile), NO_FLAGS, p);
  expect(config.applied()).toEqual(DEFAULT_SETTINGS);
  expect(config.writable).toBe(false);
});
