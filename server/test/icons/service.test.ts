import { afterEach, beforeEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Settings } from "@pokemon-memory-reader/internal/config";
import type { Clock } from "../../src/clock";
import type { IconKey } from "../../src/icons/keys";
import { DEFAULT_MAPS, type IconMaps } from "../../src/icons/plan";
import { createIconService, type IconService } from "../../src/icons/service";
import { ICON_SPRITES_SHA } from "../../src/icons/source";
import type { Log } from "../../src/log";
import { builtinProfiles } from "../../src/profile/builtin/index";
import { loadProfiles } from "../../src/profile/registry";
import type { Profile } from "../../src/profile/schema";

const { registry: builtin } = loadProfiles({
  builtin: builtinProfiles,
  user: [],
});
const emerald = builtin.get("emerald-us-1.0") as Profile;
const hack = {
  ...emerald,
  id: "radical-red",
  kind: "hack",
  dataFormat: "cfru",
} as unknown as Profile;
const profiles = new Map([
  ["emerald-us-1.0", emerald],
  ["radical-red", hack],
]);
const registry = { get: (id: string) => profiles.get(id) };

const png = (fill: number, length = 16) => {
  const bytes = new Uint8Array(length).fill(fill);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
};
const A = png(1);
const B = png(2);
const C = png(3);

const maps: IconMaps = {
  ...DEFAULT_MAPS,
  itemSlug: (_art, id) => (id === 4 ? "poke-ball" : null),
};

const pikachu: IconKey = {
  kind: "pokemon",
  profileId: "emerald-us-1.0",
  id: 25,
  shiny: false,
};
const UPSTREAM_25 = "pokemon/versions/generation-iii/emerald/25.png";
const DEFAULT_ID = `pokeapi-${ICON_SPRITES_SHA}`;
const DEFAULT_URL = `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@${ICON_SPRITES_SHA}/sprites/`;

let root: string;
let packFolder: string;
let cacheFolder: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pmr-icons-"));
  packFolder = join(root, "icons");
  cacheFolder = join(root, "icon-cache");
  await mkdir(packFolder, { recursive: true });
});
afterEach(() => rm(root, { recursive: true, force: true }));

const put = async (file: string, bytes: Uint8Array) => {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes);
};
const inPack = (path: string, bytes: Uint8Array) =>
  put(join(packFolder, ...path.split("/")), bytes);
const inCache = (sourceId: string, path: string, bytes: Uint8Array) =>
  put(join(cacheFolder, sourceId, ...path.split("/")), bytes);

const exists = (file: string) =>
  stat(file).then(
    () => true,
    () => false,
  );

function testLog() {
  const warnings: string[] = [];
  const log: Log = {
    debug() {},
    info() {},
    error() {},
    warn: (message) => {
      warnings.push(message);
    },
  };
  return { log, warnings };
}

function fakeClock() {
  let now = 1_000_000;
  const clock: Clock = {
    now: () => now,
    setTimeout: () => () => {},
  };
  return {
    clock,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

type Answer = Response | Error | (() => Promise<Response>);

function fakeUpstream(answers: Record<string, Answer> = {}) {
  const calls: string[] = [];
  let running = 0;
  let peak = 0;
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push(url);
    running++;
    peak = Math.max(peak, running);
    try {
      const path = url.slice(url.indexOf("/sprites/") + "/sprites/".length);
      const answer = answers[path];
      if (answer === undefined) return new Response(null, { status: 404 });
      if (answer instanceof Error) throw answer;
      if (typeof answer === "function") {
        const slow = answer();
        return await Promise.race([
          slow,
          new Promise<Response>((_, reject) =>
            init?.signal?.addEventListener("abort", () =>
              reject(init.signal?.reason),
            ),
          ),
        ]);
      }
      return answer.clone();
    } finally {
      running--;
    }
  }) as unknown as typeof fetch;
  return { fetch: fetchImpl, calls, peak: () => peak };
}

const ok = (bytes: Uint8Array) => new Response(bytes, { status: 200 });

function setup(
  options: {
    settings?: Settings["icons"];
    upstream?: ReturnType<typeof fakeUpstream>;
    clock?: Clock;
    log?: Log;
    timeout?: number;
  } = {},
) {
  const settings = {
    current: options.settings ?? { mode: "online", baseUrl: null },
  };
  const upstream = options.upstream ?? fakeUpstream();
  const service: IconService = createIconService({
    paths: { iconsFolder: packFolder, iconCacheFolder: cacheFolder },
    registry,
    settings: () => settings.current,
    fetch: upstream.fetch,
    clock: options.clock,
    log: options.log,
    maps,
    fetchTimeoutMs: options.timeout,
  });
  return { service, upstream, settings };
}

test("a miss fetches upstream and writes the cache, and a hit serves the cache with no fetch", async () => {
  const upstream = fakeUpstream({ [UPSTREAM_25]: ok(A) });
  const { service } = setup({ upstream });
  const first = await service.get(pikachu);
  expect(first?.bytes).toEqual(A);
  expect(upstream.calls).toEqual([`${DEFAULT_URL}${UPSTREAM_25}`]);
  const cached = join(cacheFolder, DEFAULT_ID, ...UPSTREAM_25.split("/"));
  expect(new Uint8Array(await readFile(cached))).toEqual(A);
  const second = await service.get(pikachu);
  expect(second?.bytes).toEqual(A);
  expect(upstream.calls.length).toBe(1);
});

test("a cache file written by an earlier run is a hit with no network", async () => {
  await inCache(DEFAULT_ID, UPSTREAM_25, B);
  const { service, upstream } = setup();
  expect((await service.get(pikachu))?.bytes).toEqual(B);
  expect(upstream.calls).toEqual([]);
});

test("writes go through a temp file, so no .tmp file is left", async () => {
  const { service } = setup({
    upstream: fakeUpstream({ [UPSTREAM_25]: ok(A) }),
  });
  await service.get(pikachu);
  const dir = join(
    cacheFolder,
    DEFAULT_ID,
    "pokemon",
    "versions",
    "generation-iii",
    "emerald",
  );
  expect(await readdir(dir)).toEqual(["25.png"]);
});

test("the etag is the quoted content hash", async () => {
  await inCache(DEFAULT_ID, UPSTREAM_25, A);
  const { service } = setup();
  expect((await service.get(pikachu))?.etag).toBe(
    `"${createHash("sha1").update(A).digest("hex")}"`,
  );
});

test("a missing icon is null: upstream 404s are remembered for the run and a clear forgets them", async () => {
  const upstream = fakeUpstream();
  const { service } = setup({ upstream });
  expect(await service.get(pikachu)).toBeNull();
  expect(await service.get(pikachu)).toBeNull();
  expect(upstream.calls.length).toBe(1);
  await service.clearCache();
  expect(await service.get(pikachu)).toBeNull();
  expect(upstream.calls.length).toBe(2);
});

test("an unknown profile and an unmapped id are null with no fetch", async () => {
  const { service, upstream } = setup();
  expect(await service.get({ ...pikachu, profileId: "nope" })).toBeNull();
  expect(await service.get({ ...pikachu, id: 252 })).toBeNull();
  expect(upstream.calls).toEqual([]);
});

test("lookup order for an official profile: pack, then cache, then upstream", async () => {
  const upstream = fakeUpstream({ [UPSTREAM_25]: ok(C) });
  const { service } = setup({ upstream });
  await inCache(DEFAULT_ID, UPSTREAM_25, B);
  await inPack("pokemon/emerald/25.png", A);
  expect((await service.get(pikachu))?.bytes).toEqual(A);
  await rm(join(packFolder, "pokemon"), { recursive: true });
  expect((await service.get(pikachu))?.bytes).toEqual(B);
  await rm(cacheFolder, { recursive: true });
  expect((await service.get(pikachu))?.bytes).toEqual(C);
  expect(upstream.calls.length).toBe(1);
});

test("lookup order for a hack profile: hack folder, normal pack path, cache, upstream", async () => {
  const key: IconKey = { ...pikachu, profileId: "radical-red" };
  const upstream = fakeUpstream({ [UPSTREAM_25]: ok(png(9)) });
  const { service } = setup({ upstream });
  await inCache(DEFAULT_ID, UPSTREAM_25, C);
  await inPack("pokemon/emerald/25.png", B);
  await inPack("hack/radical-red/pokemon/25.png", A);
  expect((await service.get(key))?.bytes).toEqual(A);
  await rm(join(packFolder, "hack"), { recursive: true });
  expect((await service.get(key))?.bytes).toEqual(B);
  await rm(join(packFolder, "pokemon"), { recursive: true });
  expect((await service.get(key))?.bytes).toEqual(C);
  await rm(cacheFolder, { recursive: true });
  expect((await service.get(key))?.bytes).toEqual(png(9));
});

test("a hack species outside the vanilla set stops after the hack folder", async () => {
  const key: IconKey = { ...pikachu, profileId: "radical-red", id: 900 };
  const upstream = fakeUpstream();
  const { service } = setup({ upstream });
  await inPack("pokemon/emerald/900.png", B);
  expect(await service.get(key)).toBeNull();
  await inPack("hack/radical-red/pokemon/900.png", A);
  expect((await service.get(key))?.bytes).toEqual(A);
  expect(upstream.calls).toEqual([]);
});

test("a hack item with an unmapped id is served from the hack folder only", async () => {
  const upstream = fakeUpstream();
  const { service } = setup({ upstream });
  const key: IconKey = { kind: "item", profileId: "radical-red", id: 900 };
  expect(await service.get(key)).toBeNull();
  await inPack("hack/radical-red/item/900.png", A);
  expect((await service.get(key))?.bytes).toEqual(A);
  expect(upstream.calls).toEqual([]);
});

test("local mode reads only the pack and makes no request", async () => {
  const upstream = fakeUpstream({ [UPSTREAM_25]: ok(A) });
  const { service } = setup({
    settings: { mode: "local", baseUrl: null },
    upstream,
  });
  await inCache(DEFAULT_ID, UPSTREAM_25, B);
  expect(await service.get(pikachu)).toBeNull();
  await inPack("pokemon/emerald/25.png", C);
  expect((await service.get(pikachu))?.bytes).toEqual(C);
  expect(upstream.calls).toEqual([]);
});

test("off mode answers null even when the pack has the file, and a live change applies at once", async () => {
  await inPack("pokemon/emerald/25.png", A);
  const { service, settings } = setup({
    settings: { mode: "off", baseUrl: null },
  });
  expect(await service.get(pikachu)).toBeNull();
  settings.current = { mode: "local", baseUrl: null };
  expect((await service.get(pikachu))?.bytes).toEqual(A);
});

test("a pack file that is not a PNG, or is over 512 KB, is absent and warns once", async () => {
  const { log, warnings } = testLog();
  const { service } = setup({ log });
  await inPack(
    "pokemon/emerald/25.png",
    new TextEncoder().encode("not a png at all"),
  );
  expect(await service.get(pikachu)).toBeNull();
  expect(await service.get(pikachu)).toBeNull();
  expect(warnings.length).toBe(1);
  await inPack("pokemon/emerald/25.png", png(1, 512 * 1024 + 1));
  expect(await service.get(pikachu)).toBeNull();
  await inPack("pokemon/emerald/25.png", png(1, 512 * 1024));
  expect((await service.get(pikachu))?.bytes.length).toBe(512 * 1024);
});

test("a bad pack file falls through to the cache", async () => {
  await inPack("pokemon/emerald/25.png", new Uint8Array(4));
  await inCache(DEFAULT_ID, UPSTREAM_25, B);
  const { service } = setup();
  expect((await service.get(pikachu))?.bytes).toEqual(B);
});

test("a bad cached file is deleted and fetched again", async () => {
  await inCache(
    DEFAULT_ID,
    UPSTREAM_25,
    new TextEncoder().encode("garbage garbage"),
  );
  const upstream = fakeUpstream({ [UPSTREAM_25]: ok(A) });
  const { service } = setup({ upstream });
  expect((await service.get(pikachu))?.bytes).toEqual(A);
  expect(upstream.calls.length).toBe(1);
  const cached = join(cacheFolder, DEFAULT_ID, ...UPSTREAM_25.split("/"));
  expect(new Uint8Array(await readFile(cached))).toEqual(A);
});

test("a bad upstream response isn't cached, returns null and is remembered", async () => {
  const upstream = fakeUpstream({
    [UPSTREAM_25]: new Response("<html>", { status: 200 }),
  });
  const { service } = setup({ upstream });
  expect(await service.get(pikachu)).toBeNull();
  expect(await service.get(pikachu)).toBeNull();
  expect(upstream.calls.length).toBe(1);
  expect(await exists(join(cacheFolder, DEFAULT_ID))).toBe(false);
});

test("an upstream response over 512 KB is refused", async () => {
  const upstream = fakeUpstream({ [UPSTREAM_25]: ok(png(1, 512 * 1024 + 1)) });
  const { service } = setup({ upstream });
  expect(await service.get(pikachu)).toBeNull();
  expect(await exists(join(cacheFolder, DEFAULT_ID))).toBe(false);
});

test("a network error backs the source off for 60 s, then it is tried again", async () => {
  const { clock, advance } = fakeClock();
  const upstream = fakeUpstream({ [UPSTREAM_25]: new Error("offline") });
  const { service } = setup({ upstream, clock });
  expect(await service.get(pikachu)).toBeNull();
  expect(upstream.calls.length).toBe(1);
  expect(await service.get({ ...pikachu, id: 26 })).toBeNull();
  expect(upstream.calls.length).toBe(1);
  advance(59_999);
  await service.get(pikachu);
  expect(upstream.calls.length).toBe(1);
  advance(1);
  await service.get(pikachu);
  expect(upstream.calls.length).toBe(2);
});

test("a 404 doesn't back the source off", async () => {
  const upstream = fakeUpstream();
  const { service } = setup({ upstream });
  await service.get(pikachu);
  await service.get({ ...pikachu, id: 26 });
  expect(upstream.calls.length).toBe(2);
});

test("a 5xx or 429 backs the source off, and another 4xx is a remembered miss", async () => {
  const { clock } = fakeClock();
  const upstream = fakeUpstream({
    [UPSTREAM_25]: new Response(null, { status: 503 }),
  });
  const { service } = setup({ upstream, clock });
  expect(await service.get(pikachu)).toBeNull();
  await service.get({ ...pikachu, id: 26 });
  expect(upstream.calls.length).toBe(1);

  const forbidden = fakeUpstream({
    [UPSTREAM_25]: new Response(null, { status: 403 }),
  });
  const second = setup({ upstream: forbidden, clock });
  await second.service.get(pikachu);
  await second.service.get(pikachu);
  await second.service.get({ ...pikachu, id: 26 });
  expect(forbidden.calls.length).toBe(2);
});

test("a fetch that takes longer than the timeout counts as a network error", async () => {
  const { log, warnings } = testLog();
  const upstream = fakeUpstream({
    [UPSTREAM_25]: () => new Promise<Response>(() => {}),
  });
  const { service } = setup({ upstream, log, timeout: 20 });
  expect(await service.get(pikachu)).toBeNull();
  expect(warnings.some((w) => w.includes("unreachable"))).toBe(true);
  await service.get({ ...pikachu, id: 26 });
  expect(upstream.calls.length).toBe(1);
});

test("parallel requests for one key share one fetch", async () => {
  const gate = Promise.withResolvers<Response>();
  const upstream = fakeUpstream({ [UPSTREAM_25]: () => gate.promise });
  const { service } = setup({ upstream });
  const all = [
    service.get(pikachu),
    service.get(pikachu),
    service.get(pikachu),
  ];
  await Bun.sleep(10);
  gate.resolve(ok(A));
  const results = await Promise.all(all);
  expect(results.map((r) => r?.bytes)).toEqual([A, A, A]);
  expect(upstream.calls.length).toBe(1);
});

test("at most four upstream fetches run at once and every request is answered", async () => {
  const gates = new Map<number, PromiseWithResolvers<Response>>();
  const answers: Record<string, Answer> = {};
  const ids = [1, 2, 3, 4, 5, 6, 7];
  for (const id of ids) {
    const gate = Promise.withResolvers<Response>();
    gates.set(id, gate);
    answers[`pokemon/versions/generation-iii/emerald/${id}.png`] = () =>
      gate.promise;
  }
  const upstream = fakeUpstream(answers);
  const { service } = setup({ upstream });
  const all = ids.map((id) => service.get({ ...pikachu, id }));
  await Bun.sleep(20);
  expect(upstream.calls.length).toBe(4);
  for (const id of ids) {
    gates.get(id)?.resolve(ok(png(id)));
    await Bun.sleep(2);
  }
  const results = await Promise.all(all);
  expect(results.every((r) => r !== null)).toBe(true);
  expect(upstream.calls.length).toBe(7);
  expect(upstream.peak()).toBe(4);
});

test("a mirror replaces the default, drops a trailing slash and caches under its own folder", async () => {
  const mirror = "https://mirror.example/sprites-tree/";
  const upstream = fakeUpstream({ [UPSTREAM_25]: ok(A) });
  const { service } = setup({
    settings: { mode: "online", baseUrl: mirror },
    upstream,
  });
  await service.get(pikachu);
  expect(upstream.calls).toEqual([
    `https://mirror.example/sprites-tree/sprites/${UPSTREAM_25}`,
  ]);
  const id = `mirror-${createHash("sha256")
    .update("https://mirror.example/sprites-tree")
    .digest("hex")
    .slice(0, 12)}`;
  expect(await readdir(cacheFolder)).toEqual([id]);
});

test("the source in use follows the current baseUrl, so a switch fetches fresh and keeps the old folder", async () => {
  await inCache(DEFAULT_ID, UPSTREAM_25, B);
  const upstream = fakeUpstream({ [UPSTREAM_25]: ok(A) });
  const { service, settings } = setup({ upstream });
  expect((await service.get(pikachu))?.bytes).toEqual(B);
  settings.current = { mode: "online", baseUrl: "http://localhost:9/" };
  expect((await service.get(pikachu))?.bytes).toEqual(A);
  expect((await readdir(cacheFolder)).length).toBe(2);
});

test("startup prunes every cache folder except the source in use, and leaves loose files", async () => {
  await inCache(DEFAULT_ID, UPSTREAM_25, A);
  await inCache("pokeapi-oldsha", UPSTREAM_25, A);
  await inCache("mirror-abc123abc123", UPSTREAM_25, A);
  await writeFile(join(cacheFolder, "note.txt"), "keep");
  const { service } = setup();
  await service.pruneCache();
  expect((await readdir(cacheFolder)).sort()).toEqual(["note.txt", DEFAULT_ID]);
  const mirror = setup({ settings: { mode: "local", baseUrl: "http://m/" } });
  await mirror.service.pruneCache();
  expect(await readdir(cacheFolder)).toEqual(["note.txt"]);
});

test("pruning and clearing with no cache folder are quiet", async () => {
  const { log, warnings } = testLog();
  const { service } = setup({ log });
  await service.pruneCache();
  await service.clearCache();
  expect(warnings).toEqual([]);
});

test("a clear empties every source folder, and the next request fetches again", async () => {
  const upstream = fakeUpstream({ [UPSTREAM_25]: ok(A) });
  const { service } = setup({ upstream });
  await service.get(pikachu);
  await inCache("mirror-abc123abc123", UPSTREAM_25, B);
  await service.clearCache();
  expect(await readdir(cacheFolder)).toEqual([]);
  await service.get(pikachu);
  expect(upstream.calls.length).toBe(2);
});

test("a failed cache write warns and still serves the fetched icon", async () => {
  const { log, warnings } = testLog();
  await writeFile(cacheFolder, "a file where the folder should be");
  const { service } = setup({
    log,
    upstream: fakeUpstream({ [UPSTREAM_25]: ok(A) }),
  });
  expect((await service.get(pikachu))?.bytes).toEqual(A);
  expect(warnings.some((w) => w.includes("could not be written"))).toBe(true);
});
