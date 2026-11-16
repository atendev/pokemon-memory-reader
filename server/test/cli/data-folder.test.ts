import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DATA_SUBFOLDERS,
  defaultDataFolder,
  ensureDataFolder,
  installBridges,
} from "../../src/data-folder";
import { silentLog } from "../../src/log";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pmr-data-"));
});
afterEach(() => rm(root, { recursive: true, force: true }));

test("the default folder follows each OS's convention", () => {
  const home = "/home/ash";
  expect(defaultDataFolder({ platform: "linux", env: {}, home })).toBe(
    join(home, ".local", "share", "pokemon-memory-reader"),
  );
  expect(
    defaultDataFolder({
      platform: "linux",
      env: { XDG_DATA_HOME: "/xdg" },
      home,
    }),
  ).toBe(join("/xdg", "pokemon-memory-reader"));
  expect(defaultDataFolder({ platform: "darwin", env: {}, home })).toBe(
    join(home, "Library", "Application Support", "pokemon-memory-reader"),
  );
  expect(
    defaultDataFolder({
      platform: "win32",
      env: { APPDATA: "C:\\Roaming" },
      home,
    }),
  ).toBe(join("C:\\Roaming", "pokemon-memory-reader"));
  expect(defaultDataFolder({ platform: "win32", env: {}, home })).toBe(
    join(home, "AppData", "Roaming", "pokemon-memory-reader"),
  );
});

test("ensureDataFolder creates the root and its subfolders, and can run twice", async () => {
  const target = join(root, "nested", "data");
  await ensureDataFolder(target);
  await ensureDataFolder(target);
  for (const name of DATA_SUBFOLDERS)
    expect((await stat(join(target, name))).isDirectory()).toBe(true);
});

test("installBridges writes the file, and rewrites only when the content changed", async () => {
  await ensureDataFolder(root);
  const path = join(root, "bridges", "mgba.lua");
  await installBridges(root, { mgba: "one" }, silentLog);
  expect(await readFile(path, "utf8")).toBe("one");

  const old = new Date(2000, 0, 1);
  await utimes(path, old, old);
  await installBridges(root, { mgba: "one" }, silentLog);
  expect((await stat(path)).mtime.getTime()).toBe(old.getTime());

  await installBridges(root, { mgba: "two" }, silentLog);
  expect(await readFile(path, "utf8")).toBe("two");
});

test("a failed write is logged and does not throw", async () => {
  // No bridges/ folder, so the write fails.
  const errors: string[] = [];
  await installBridges(
    root,
    { mgba: "x" },
    {
      ...silentLog,
      error: (message) => void errors.push(message),
    },
  );
  expect(errors).toHaveLength(1);
});
