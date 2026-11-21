import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { noPickStore, openPickStore } from "../../src/identify/pick-store";
import { type Log, silentLog } from "../../src/log";

let folder: string;
let path: string;

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "picks-"));
  path = join(folder, "manual-picks.json");
});
afterEach(() => rm(folder, { recursive: true, force: true }));

const capture = () => {
  const warnings: string[] = [];
  const log: Log = { ...silentLog, warn: (m) => void warnings.push(m) };
  return { log, warnings };
};

test("a store with no file finds nothing", async () => {
  const store = await openPickStore(path, silentLog);
  expect(store.lookup(["sha1:aa"])).toBeNull();
});

test("a saved pick is found by any of its keys, in the order given", async () => {
  const store = await openPickStore(path, silentLog);
  expect(await store.save(["sha1:aa", "crc32:bb"], "emerald-us-1.0")).toBe(
    true,
  );
  expect(store.lookup(["crc32:bb"])).toEqual({
    key: "crc32:bb",
    profileId: "emerald-us-1.0",
  });
  expect(store.lookup(["sha1:zz", "sha1:aa"])?.key).toBe("sha1:aa");
});

test("a pick survives a restart", async () => {
  const first = await openPickStore(path, silentLog);
  await first.save(["header:gba:BPEE:1:POKEMON EMER"], "emerald-us-1.0");
  await first.save(["base:emerald-us-1.0"], "emerald-us-1.0");
  const second = await openPickStore(path, silentLog);
  expect(second.lookup(["header:gba:BPEE:1:POKEMON EMER"])?.profileId).toBe(
    "emerald-us-1.0",
  );
  expect(second.lookup(["base:emerald-us-1.0"])).not.toBeNull();
  expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({
    version: 1,
  });
});

test("forgetting removes every key's entry, and the removal survives a restart", async () => {
  const store = await openPickStore(path, silentLog);
  await store.save(["sha1:aa", "crc32:bb"], "p");
  await store.save(["sha1:cc"], "p");
  expect(await store.forget(["sha1:aa", "crc32:bb"])).toBe(true);
  expect(store.lookup(["sha1:aa", "crc32:bb"])).toBeNull();
  const again = await openPickStore(path, silentLog);
  expect(again.lookup(["sha1:aa"])).toBeNull();
  expect(again.lookup(["sha1:cc"])).not.toBeNull();
});

test("a save keeps what another instance wrote to the file in the meantime", async () => {
  const mine = await openPickStore(path, silentLog);
  const theirs = await openPickStore(path, silentLog);
  await theirs.save(["sha1:theirs"], "other");
  await mine.save(["sha1:mine"], "p");
  const reopened = await openPickStore(path, silentLog);
  expect(reopened.lookup(["sha1:theirs"])?.profileId).toBe("other");
  expect(reopened.lookup(["sha1:mine"])?.profileId).toBe("p");
});

test("a save leaves no temp file behind", async () => {
  const store = await openPickStore(path, silentLog);
  await store.save(["sha1:aa"], "p");
  expect(await readdir(folder)).toEqual(["manual-picks.json"]);
});

test.each([
  ["not JSON", "{nope"],
  ["the wrong shape", JSON.stringify({ version: 1, picks: [] })],
  ["another version", JSON.stringify({ version: 2, picks: {} })],
])(
  "a file with %s is renamed to .bad and the store starts empty",
  async (_name, text) => {
    await writeFile(path, text);
    const { log, warnings } = capture();
    const store = await openPickStore(path, log);
    expect(store.lookup(["sha1:aa"])).toBeNull();
    expect(await readFile(`${path}.bad`, "utf8")).toBe(text);
    expect(warnings).toHaveLength(1);
    expect(await store.save(["sha1:aa"], "p")).toBe(true);
    expect(await readFile(`${path}.bad`, "utf8")).toBe(text);
  },
);

test("a save that can't write still applies for this run and reports false", async () => {
  const store = await openPickStore(
    join(path, "nested", "picks.json"),
    silentLog,
  );
  await writeFile(path, "a file where a folder is needed");
  expect(await store.save(["sha1:aa"], "p")).toBe(false);
  expect(store.lookup(["sha1:aa"])?.profileId).toBe("p");
  expect(await store.forget(["sha1:aa"])).toBe(false);
  expect(store.lookup(["sha1:aa"])).toBeNull();
});

test("a pick a failed write kept for this run survives a later successful write of another key", async () => {
  const store = await openPickStore(path, silentLog);
  await rm(folder, { recursive: true, force: true });
  await writeFile(folder, "a file where the folder was");
  expect(await store.save(["sha1:aa"], "p")).toBe(false);
  await rm(folder, { force: true });
  expect(await store.save(["sha1:bb"], "q")).toBe(true);
  expect(store.lookup(["sha1:aa"])?.profileId).toBe("p");
  expect(store.lookup(["sha1:bb"])?.profileId).toBe("q");
  expect(await store.save(["sha1:aa"], "r")).toBe(true);
  expect(store.lookup(["sha1:aa"])?.profileId).toBe("r");
  const again = await openPickStore(path, silentLog);
  expect(again.lookup(["sha1:aa"])?.profileId).toBe("r");
});

test("the no-file store finds nothing and saves nothing", async () => {
  expect(noPickStore.lookup(["sha1:aa"])).toBeNull();
  expect(await noPickStore.save(["sha1:aa"], "p")).toBe(false);
  expect(await noPickStore.forget(["sha1:aa"])).toBe(false);
});
