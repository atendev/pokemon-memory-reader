import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { aboutBody } from "@pokemon-memory-reader/internal/about";
import { adaptersBody } from "@pokemon-memory-reader/internal/adapters-route";
import { DEFAULT_SETTINGS } from "@pokemon-memory-reader/internal/config";
import {
  INTERNAL_ERROR_CODES,
  INTERNAL_ERROR_STATUS,
  internalErrorBody,
} from "@pokemon-memory-reader/internal/errors";
import {
  type ManualPicksBody,
  manualPicksBody,
  pickBody,
} from "@pokemon-memory-reader/internal/manual-picks-route";
import { settingsBody } from "@pokemon-memory-reader/internal/settings-route";
import { updateBody } from "@pokemon-memory-reader/internal/update";
import { createSelector } from "../../src/adapter/selector";
import { type AboutInfo, createApp } from "../../src/app/app";
import { ROUTES } from "../../src/app/route-table";
import { readConfigFile, resolveConfig } from "../../src/config";
import { resolvePaths } from "../../src/data-folder";
import { createIconService } from "../../src/icons/service";
import { silentLog } from "../../src/log";
import type { RawReadResult, Resources } from "../../src/loop/read-loop";
import { builtinProfiles } from "../../src/profile/builtin/index";
import { loadProfiles } from "../../src/profile/registry";
import {
  createUpdateChecker,
  followUpdateSetting,
} from "../../src/update/check";
import { ManualClock } from "../bridge/manual-clock";

const status = {
  state: "disconnected",
  adapter: null,
  rom: null,
  game: null,
} as const;
const idle: Resources = {
  status: () => status,
  get: () => Promise.reject(new Error("unused")),
  box: () => Promise.reject(new Error("unused")),
};

const PORT = 7425;
const HOST = `127.0.0.1:${PORT}`;
const loopback = { requestIP: () => ({ address: "127.0.0.1" }) };
const lan = { requestIP: () => ({ address: "192.168.1.20" }) };

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pmr-routes-"));
});
afterEach(() => rm(root, { recursive: true, force: true }));

const paths = () =>
  resolvePaths({ platform: "linux", env: {}, dataDirFlag: root });

async function loadConfig(contents: string | null = null) {
  const p = paths();
  if (contents !== null) await writeFile(p.configFile, contents);
  return resolveConfig(
    await readConfigFile(p.configFile),
    { port: null, host: null, openBrowser: null },
    p,
  );
}

const ABOUT: AboutInfo = {
  version: "2.0.0",
  target: "linux-x64",
  commit: "dev",
  versionLine: "pokemon-memory-reader 2.0.0 (dev, linux-x64)",
  protocol: 1,
  lgpl: [{ displayName: "JavaScriptCore", copyright: "Copyright Apple Inc." }],
  notices: "NOTICES TEXT",
};

const okRead: RawReadResult = {
  ok: true,
  value: {
    address: "0x02024284",
    domain: "ewram",
    offset: 0x24284,
    length: 2,
    hex: "abcd",
  },
};

const iconRegistry = loadProfiles({
  builtin: builtinProfiles,
  user: [],
}).registry;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7]);

function iconService(mode: "online" | "local" | "off") {
  const p = paths();
  return createIconService({
    paths: { iconsFolder: p.iconsFolder, iconCacheFolder: p.iconCacheFolder },
    registry: iconRegistry,
    settings: () => ({ mode, baseUrl: null }),
    fetch: (() =>
      Promise.reject(new Error("no network"))) as unknown as typeof fetch,
  });
}

const RELEASE = {
  tag_name: "v2.1.0",
  html_url:
    "https://github.com/atendev/pokemon-memory-reader/releases/tag/v2.1.0",
  draft: false,
  prerelease: false,
};

/** An update checker on a fake feed, so no request leaves the process. */
function updateChecker(enabled = true) {
  const requests: string[] = [];
  const clock = new ManualClock();
  const checker = createUpdateChecker({
    current: "2.0.0",
    enabled,
    feedUrl: "https://feed.test/releases",
    fetch: (url) => {
      requests.push(url);
      return Promise.resolve(new Response(JSON.stringify([RELEASE])));
    },
    clock,
    log: silentLog,
  });
  return { checker, requests, clock };
}

const PICKED = {
  key: "sha1:abc",
  scope: "rom",
  profileId: "emerald",
  saved: true,
  reason: null,
} as const;

const LISTED: ManualPicksBody = {
  romKey: "sha1:abc",
  current: null,
  candidates: [
    {
      id: "emerald-us-1.0",
      name: "Pokémon Emerald (US) 1.0",
      kind: "official",
      dataFormat: "gen3",
      headerMatch: true,
      signature: "match",
      baseEligible: true,
    },
  ],
};

const picksStub = {
  pickList: () => Promise.resolve(LISTED),
  pick: () => Promise.resolve({ ok: true, value: PICKED } as const),
  forget: () => Promise.resolve({ ok: true } as const),
};

async function everything(
  read?: (address: string, length: number) => Promise<RawReadResult>,
) {
  return createApp({
    resources: idle,
    bridges: { mgba: "-- mgba" },
    config: await loadConfig(),
    selector: createSelector({
      create: () => null,
      endpoint: () => ({ host: "127.0.0.1", port: 1 }),
      pin: "auto",
      clock: new ManualClock(),
      log: silentLog,
    }),
    about: ABOUT,
    update: updateChecker().checker,
    icons: iconService("local"),
    picks: picksStub,
    rawRead: read ?? (() => Promise.resolve(okRead)),
    listening: () => ({ host: "127.0.0.1", port: PORT }),
  });
}

const put = (body: unknown, headers: Record<string, string> = {}) => ({
  method: "PUT",
  body: JSON.stringify(body),
  headers: {
    Host: HOST,
    "Content-Type": "application/json",
    ...headers,
  },
});

// Route table

const concrete = (path: string) => path.replace(":file", "mgba.lua");

test("every row of the route table is registered, and every registered route has a row", async () => {
  const app = await everything();
  const registered = app.routes
    .filter((route) => !route.path.startsWith("/api/v2"))
    .filter((route) => route.method !== "ALL")
    .map((route) => `${route.method} ${route.path}`);
  const listed = ROUTES.map((route) => `${route.method} ${route.path}`);
  expect(new Set(registered)).toEqual(new Set(listed));
  expect(new Set(listed).size).toBe(listed.length);
});

test("a bad Host to every write and debug route is a 403 write_forbidden", async () => {
  const app = await everything();
  const guarded = ROUTES.filter(
    (route) => route.guard === "write" || route.guard === "debug",
  );
  expect(guarded.length).toBeGreaterThan(0);
  for (const route of guarded) {
    const response = await app.request(
      `${concrete(route.path)}?address=0x02024284&length=2`,
      {
        method: route.method,
        body: route.method === "GET" ? undefined : "{}",
        headers: {
          Host: "evil.example:7425",
          "Content-Type": "application/json",
        },
      },
      loopback,
    );
    expect(response.status).toBe(403);
    expect(internalErrorBody.parse(await response.json()).error.code).toBe(
      "write_forbidden",
    );
  }
});

test("a good request reaches every open route from a LAN peer", async () => {
  const app = await everything();
  for (const route of ROUTES.filter((r) => r.guard === "open")) {
    const response = await app.request(
      concrete(route.path),
      { headers: { Host: "192.168.1.5:7425" } },
      lan,
    );
    expect(response.status).toBe(200);
  }
});

test("the route table gives each route the expected class", () => {
  const classOf = (method: string, path: string) =>
    ROUTES.find((r) => r.method === method && r.path === path)?.guard;
  expect(classOf("GET", "/settings")).toBe("open");
  expect(classOf("PUT", "/settings")).toBe("write");
  expect(classOf("GET", "/manual-picks")).toBe("open");
  expect(classOf("POST", "/manual-picks")).toBe("write");
  expect(classOf("POST", "/manual-picks/forget")).toBe("write");
  expect(classOf("GET", "/about")).toBe("open");
  expect(classOf("GET", "/about/third-party-notices.txt")).toBe("open");
  expect(classOf("GET", "/debug/read")).toBe("debug");
  expect(classOf("GET", "/icons/*")).toBe("static");
});

// Write guard

test("a PUT passes the guard from loopback with the right Host and Content-Type", async () => {
  const app = await everything();
  const response = await app.request(
    "/settings",
    put({ pollHz: 25 }),
    loopback,
  );
  expect(response.status).toBe(200);
});

test.each([
  ["a non-loopback peer", lan, put({})],
  ["no peer address", undefined, put({})],
  [
    "a non-JSON Content-Type",
    loopback,
    put({}, { "Content-Type": "text/plain" }),
  ],
  [
    "no Content-Type",
    loopback,
    {
      method: "PUT",
      body: "{}",
      headers: { Host: HOST },
    },
  ],
  ["a foreign Host", loopback, put({}, { Host: "evil.example:7425" })],
  ["the wrong port", loopback, put({}, { Host: "127.0.0.1:9999" })],
  ["a Host without the port", loopback, put({}, { Host: "127.0.0.1" })],
  ["a foreign Origin", loopback, put({}, { Origin: "http://evil.example" })],
])("the write guard refuses %s", async (_name, env, init) => {
  const app = await everything();
  const response = await app.request("/settings", init, env);
  expect(response.status).toBe(403);
  expect(internalErrorBody.parse(await response.json()).error.code).toBe(
    "write_forbidden",
  );
});

test("the write guard accepts the server's own Origin and a localhost Host", async () => {
  const app = await everything();
  const own = await app.request(
    "/settings",
    put({}, { Origin: `http://${HOST}` }),
    loopback,
  );
  expect(own.status).toBe(200);
  const named = await app.request(
    "/settings",
    put({}, { Host: `localhost:${PORT}`, Origin: `http://localhost:${PORT}` }),
    loopback,
  );
  expect(named.status).toBe(200);
});

test("the write guard accepts the configured bind host, the debug guard does not", async () => {
  const app = createApp({
    resources: idle,
    config: await loadConfig(),
    rawRead: () => Promise.resolve(okRead),
    listening: () => ({ host: "192.168.1.5", port: PORT }),
  });
  const write = await app.request(
    "/settings",
    put({}, { Host: `192.168.1.5:${PORT}` }),
    loopback,
  );
  expect(write.status).toBe(200);
  const debug = await app.request(
    "/debug/read?address=0x02024284&length=2",
    { headers: { Host: `192.168.1.5:${PORT}` } },
    loopback,
  );
  expect(debug.status).toBe(403);
});

test("a bracketed IPv6 bind host is a valid Host", async () => {
  const app = createApp({
    resources: idle,
    config: await loadConfig(),
    listening: () => ({ host: "::1", port: PORT }),
  });
  const response = await app.request(
    "/settings",
    put({}, { Host: `[::1]:${PORT}` }),
    { requestIP: () => ({ address: "::1" }) },
  );
  expect(response.status).toBe(200);
});

test("an IPv4-mapped loopback peer counts as loopback", async () => {
  const app = await everything();
  const response = await app.request("/settings", put({}), {
    requestIP: () => ({ address: "::ffff:127.0.0.1" }),
  });
  expect(response.status).toBe(200);
});

test("the Host check ignores case", async () => {
  const app = await everything();
  const response = await app.request(
    "/settings",
    put({}, { Host: `LOCALHOST:${PORT}` }),
    loopback,
  );
  expect(response.status).toBe(200);
});

test("the debug guard needs a loopback peer", async () => {
  const app = await everything();
  const response = await app.request(
    "/debug/read?address=0x02024284&length=2",
    { headers: { Host: HOST } },
    lan,
  );
  expect(response.status).toBe(403);
});

// CORS

test("an internal route sends no Access-Control-Allow-Origin and approves no preflight", async () => {
  const app = await everything();
  const response = await app.request(
    "/settings",
    {
      method: "OPTIONS",
      headers: {
        Host: HOST,
        Origin: "http://evil.example",
        "Access-Control-Request-Method": "PUT",
      },
    },
    loopback,
  );
  expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  expect(response.headers.get("Access-Control-Allow-Methods")).toBeNull();
  const read = await app.request("/settings", {}, loopback);
  expect(read.headers.get("Access-Control-Allow-Origin")).toBeNull();
});

test("the public API keeps its open CORS header", async () => {
  const app = await everything();
  const response = await app.request("/api/v2/status");
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
});

// GET /settings

test("GET /settings fills paths for loopback and nulls them for a LAN reader", async () => {
  const app = await everything();
  const near = settingsBody.parse(
    await (await app.request("/settings", {}, loopback)).json(),
  );
  expect(near.paths).toEqual({
    dataFolder: root,
    configFile: paths().configFile,
    profiles: join(root, "profiles"),
    bridges: join(root, "bridges"),
    iconPack: join(root, "icons"),
    iconCache: join(root, "icon-cache"),
  });
  const far = settingsBody.parse(
    await (await app.request("/settings", {}, lan)).json(),
  );
  expect(far.paths).toBeNull();
  expect(far.iconCache.bytes).toBe(0);
  expect(JSON.stringify(far)).not.toContain(root);
});

test("GET /settings with no peer address counts as a LAN reader", async () => {
  const app = await everything();
  const body = settingsBody.parse(
    await (await app.request("/settings")).json(),
  );
  expect(body.paths).toBeNull();
});

test("GET /settings reports the icon cache size to every peer", async () => {
  await Bun.write(join(root, "icon-cache", "a.png"), "12345");
  const app = await everything();
  const far = settingsBody.parse(
    await (await app.request("/settings", {}, lan)).json(),
  );
  expect(far.iconCache.bytes).toBe(5);
});

test("GET /settings shows endpoints, pollHz and updateCheck", async () => {
  const app = await everything();
  const body = settingsBody.parse(
    await (await app.request("/settings", {}, lan)).json(),
  );
  expect(body.settings.pollHz.value).toBe(DEFAULT_SETTINGS.pollHz);
  expect(body.settings.updateCheck.value).toBe(true);
  expect(body.settings.adapters.value.mgba.port).toBeGreaterThan(0);
  expect(body.saves).toEqual({ writable: true, refusal: null });
});

// PUT /settings

const readFileJson = async () =>
  JSON.parse(await readFile(paths().configFile, "utf8")) as Record<
    string,
    unknown
  >;

test("the first save creates config.json and applies a live key at once", async () => {
  const config = await loadConfig();
  const app = createApp({
    resources: idle,
    config,
    listening: () => ({ host: "127.0.0.1", port: PORT }),
  });
  expect(await Bun.file(paths().configFile).exists()).toBe(false);
  const response = await app.request(
    "/settings",
    put({ pollHz: 25 }),
    loopback,
  );
  expect(response.status).toBe(200);
  const body = settingsBody.parse(await response.json());
  expect(body.settings.pollHz.value).toBe(25);
  expect(body.paths).not.toBeNull();
  expect((await readFileJson()).pollHz).toBe(25);
  expect(config.applied().pollHz).toBe(25);
});

test("a save keeps unknown keys and untouched settings in the file", async () => {
  const config = await loadConfig(
    JSON.stringify({ configVersion: 1, port: 8000, futureKey: { a: 1 } }),
  );
  const app = createApp({
    resources: idle,
    config,
    listening: () => ({ host: "127.0.0.1", port: PORT }),
  });
  const response = await app.request(
    "/settings",
    put({ updateCheck: false }),
    loopback,
  );
  expect(response.status).toBe(200);
  const file = await readFileJson();
  expect(file.futureKey).toEqual({ a: 1 });
  expect(file.port).toBe(8000);
  expect(file.updateCheck).toBe(false);
});

test("a save keeps keys another instance wrote after startup", async () => {
  const config = await loadConfig('{"port": 8000}');
  await writeFile(
    paths().configFile,
    JSON.stringify({ port: 8000, openBrowser: false }),
  );
  const app = createApp({
    resources: idle,
    config,
    listening: () => ({ host: "127.0.0.1", port: PORT }),
  });
  await app.request("/settings", put({ pollHz: 15 }), loopback);
  const file = await readFileJson();
  expect(file.openBrowser).toBe(false);
  expect(file.pollHz).toBe(15);
});

test("a nested patch merges into adapters and leaves the other fields", async () => {
  const config = await loadConfig(
    JSON.stringify({ adapters: { mgba: { host: "127.0.0.1", port: 9000 } } }),
  );
  const app = createApp({
    resources: idle,
    config,
    listening: () => ({ host: "127.0.0.1", port: PORT }),
  });
  const response = await app.request(
    "/settings",
    put({ adapters: { retroarch: { port: 55356 } } }),
    loopback,
  );
  expect(response.status).toBe(200);
  const file = (await readFileJson()) as {
    adapters: Record<string, { port?: number }>;
  };
  expect(file.adapters.mgba?.port).toBe(9000);
  expect(file.adapters.retroarch?.port).toBe(55356);
});

test("an empty patch writes nothing", async () => {
  const app = await everything();
  const response = await app.request("/settings", put({}), loopback);
  expect(response.status).toBe(200);
  expect(await Bun.file(paths().configFile).exists()).toBe(false);
});

test.each([
  ["an unknown key", { nope: 1 }],
  ["configVersion", { configVersion: 2 }],
  ["pollHz above the range", { pollHz: 61 }],
  ["pollHz below the range", { pollHz: 4 }],
  ["a non-integer pollHz", { pollHz: 25.5 }],
  ["a wrong type", { updateCheck: "yes" }],
  ["an unknown nested key", { adapters: { mgba: { nope: 1 } } }],
  ["an array body", []],
  ["a null body", null],
])(
  "a patch with %s is invalid_setting and writes nothing",
  async (_n, patch) => {
    const config = await loadConfig();
    const app = createApp({
      resources: idle,
      config,
      listening: () => ({ host: "127.0.0.1", port: PORT }),
    });
    const response = await app.request("/settings", put(patch), loopback);
    expect(response.status).toBe(400);
    expect(internalErrorBody.parse(await response.json()).error.code).toBe(
      "invalid_setting",
    );
    expect(await Bun.file(paths().configFile).exists()).toBe(false);
    expect(config.applied().pollHz).toBe(DEFAULT_SETTINGS.pollHz);
  },
);

test("an unparseable body is invalid_setting", async () => {
  const app = await everything();
  const response = await app.request(
    "/settings",
    { ...put({}), body: "{ nope" },
    loopback,
  );
  expect(response.status).toBe(400);
  expect(internalErrorBody.parse(await response.json()).error.code).toBe(
    "invalid_setting",
  );
});

test("a malformed config.json refuses the save with saves_refused and the path", async () => {
  const config = await loadConfig("{ nope");
  const app = createApp({
    resources: idle,
    config,
    listening: () => ({ host: "127.0.0.1", port: PORT }),
  });
  const response = await app.request(
    "/settings",
    put({ pollHz: 25 }),
    loopback,
  );
  expect(response.status).toBe(409);
  const body = internalErrorBody.parse(await response.json());
  expect(body.error.code).toBe("saves_refused");
  expect(body.error.message).toContain(paths().configFile);
  expect(await readFile(paths().configFile, "utf8")).toBe("{ nope");
  expect(config.applied().pollHz).toBe(DEFAULT_SETTINGS.pollHz);
});

test("a file that went bad since startup refuses the save", async () => {
  const config = await loadConfig('{"port": 8000}');
  await writeFile(paths().configFile, "{ broken");
  const app = createApp({
    resources: idle,
    config,
    listening: () => ({ host: "127.0.0.1", port: PORT }),
  });
  const response = await app.request(
    "/settings",
    put({ pollHz: 25 }),
    loopback,
  );
  expect(response.status).toBe(409);
  expect(internalErrorBody.parse(await response.json()).error.code).toBe(
    "saves_refused",
  );
  expect(config.applied().pollHz).toBe(DEFAULT_SETTINGS.pollHz);
});

test("a newer configVersion refuses the save", async () => {
  const config = await loadConfig('{"configVersion": 99}');
  const app = createApp({
    resources: idle,
    config,
    listening: () => ({ host: "127.0.0.1", port: PORT }),
  });
  const response = await app.request(
    "/settings",
    put({ pollHz: 25 }),
    loopback,
  );
  expect(response.status).toBe(409);
  expect(internalErrorBody.parse(await response.json()).error.code).toBe(
    "saves_refused",
  );
});

test("a write that fails on I/O is save_failed and changes nothing in memory", async () => {
  const config = await loadConfig();
  // The config file's folder is a file, so the temp file can't be created.
  await writeFile(join(root, "blocker"), "");
  const blocked = {
    ...config,
    paths: {
      ...config.paths,
      configFile: join(root, "blocker", "config.json"),
    },
  };
  const app = createApp({
    resources: idle,
    config: blocked,
    listening: () => ({ host: "127.0.0.1", port: PORT }),
  });
  const response = await app.request(
    "/settings",
    put({ pollHz: 25 }),
    loopback,
  );
  expect(response.status).toBe(500);
  expect(internalErrorBody.parse(await response.json()).error.code).toBe(
    "save_failed",
  );
  expect(config.applied().pollHz).toBe(DEFAULT_SETTINGS.pollHz);
});

test("a startup key saves, stays unapplied and is reported pending", async () => {
  const app = await everything();
  const response = await app.request(
    "/settings",
    put({ port: 8123 }),
    loopback,
  );
  expect(response.status).toBe(200);
  const body = settingsBody.parse(await response.json());
  expect(body.settings.port.value).toBe(7425);
  expect(body.settings.port.pending).toBe(8123);
  expect(body.settings.port.restartRequired).toBe(true);
});

// /about

test("GET /about serves the version, the LGPL lines and whether notices exist", async () => {
  const app = await everything();
  const response = await app.request("/about", {}, lan);
  expect(response.status).toBe(200);
  const body = aboutBody.parse(await response.json());
  expect(body).toEqual({
    version: "2.0.0",
    target: "linux-x64",
    commit: "dev",
    versionLine: ABOUT.versionLine,
    protocol: 1,
    lgpl: ABOUT.lgpl,
    notices: true,
  });
  expect(JSON.stringify(body)).not.toContain("NOTICES TEXT");
});

test("the notices file is served as plain text with nosniff", async () => {
  const app = await everything();
  const response = await app.request("/about/third-party-notices.txt", {}, lan);
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe(
    "text/plain; charset=utf-8",
  );
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(await response.text()).toBe("NOTICES TEXT");
});

test("a dev build without notices answers 404 and about says notices is false", async () => {
  const app = createApp({
    resources: idle,
    about: { ...ABOUT, notices: null },
  });
  const notices = await app.request("/about/third-party-notices.txt");
  expect(notices.status).toBe(404);
  expect(notices.headers.get("Content-Type")).toContain("text/plain");
  const about = aboutBody.parse(await (await app.request("/about")).json());
  expect(about.notices).toBe(false);
});

// /debug/read

const debugGet = (query: string, app: ReturnType<typeof createApp>) =>
  app.request(`/debug/read${query}`, { headers: { Host: HOST } }, loopback);

test("/debug/read passes a good read through", async () => {
  const calls: [string, number][] = [];
  const app = await everything((address, length) => {
    calls.push([address, length]);
    return Promise.resolve(okRead);
  });
  const response = await debugGet("?address=0x02024284&length=2", app);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(okRead.ok ? okRead.value : null);
  expect(calls).toEqual([["0x02024284", 2]]);
});

test.each([
  ["", "a missing address"],
  ["?length=2", "a missing address"],
  ["?address=&length=2", "an empty address"],
  ["?address=0x02024284", "a missing length"],
  ["?address=0x02024284&length=abc", "a non-integer length"],
  ["?address=0x02024284&length=1.5", "a fractional length"],
  ["?address=0x02024284&length=", "an empty length"],
])("/debug/read %s (%s) is invalid_request", async (query) => {
  let called = false;
  const app = await everything(() => {
    called = true;
    return Promise.resolve(okRead);
  });
  const response = await debugGet(query, app);
  expect(response.status).toBe(400);
  expect(internalErrorBody.parse(await response.json()).error.code).toBe(
    "invalid_request",
  );
  expect(called).toBe(false);
});

test.each([
  ["invalid_request", 400],
  ["bad_read", 400],
  ["not_connected", 409],
  ["read_busy", 409],
] as const)("/debug/read maps the loop's %s to %d", async (code, http) => {
  const app = await everything(() =>
    Promise.resolve({ ok: false, code, message: "nope" }),
  );
  const response = await debugGet("?address=0x02024284&length=2", app);
  expect(response.status).toBe(http);
  const body = internalErrorBody.parse(await response.json());
  expect(body.error.code).toBe(code);
  expect(body.error.message).toBe("nope");
});

test("the debug routes are absent without the flag", async () => {
  const app = createApp({
    resources: idle,
    config: await loadConfig(),
    about: ABOUT,
  });
  const response = await app.request(
    "/debug/read?address=0x02024284&length=2",
    { headers: { Host: HOST } },
    loopback,
  );
  expect(response.status).toBe(404);
});

test("without config there are no settings routes, and without about no about routes", async () => {
  const app = createApp({ resources: idle });
  expect((await app.request("/settings", {}, loopback)).status).toBe(404);
  expect((await app.request("/about")).status).toBe(404);
});

// Error codes

test("the internal error codes are the closed 18 of amendment 021", () => {
  expect([...INTERNAL_ERROR_CODES]).toEqual([
    "write_forbidden",
    "invalid_request",
    "invalid_setting",
    "saves_refused",
    "save_failed",
    "adapter_not_usable",
    "adapter_pinned",
    "adapter_connect_failed",
    "switch_in_progress",
    "no_rom",
    "pick_not_allowed",
    "forget_not_allowed",
    "base_pick_not_allowed",
    "unknown_profile",
    "expansion_rom",
    "not_connected",
    "bad_read",
    "read_busy",
  ]);
  expect(Object.keys(INTERNAL_ERROR_STATUS).sort()).toEqual(
    [...INTERNAL_ERROR_CODES].sort(),
  );
});

test("an internal error body carries no public status and rejects an unknown code", () => {
  expect(() =>
    internalErrorBody.parse({ error: { code: "mystery", message: "x" } }),
  ).toThrow();
  expect(
    internalErrorBody.parse({ error: { code: "no_rom", message: "x" } }),
  ).toEqual({ error: { code: "no_rom", message: "x" } });
});

// Icons

const ICON = "/icons/emerald-us-1.0/pokemon/25";

async function withPackedIcon() {
  const dir = join(paths().iconsFolder, "pokemon", "emerald");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "25.png"), PNG);
  return everything();
}

test("the icons route serves the PNG with its headers, to a LAN peer too", async () => {
  const app = await withPackedIcon();
  const response = await app.request(
    ICON,
    { headers: { Host: "192.168.1.5:7425" } },
    lan,
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("image/png");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("Cache-Control")).toBe("no-cache");
  expect(response.headers.get("ETag")).toMatch(/^"[0-9a-f]{40}"$/);
  expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
});

test("a matching If-None-Match gets a 304 with no body, and a stale one gets the image", async () => {
  const app = await withPackedIcon();
  const etag = (await app.request(ICON)).headers.get("ETag") as string;
  const same = await app.request(ICON, { headers: { "If-None-Match": etag } });
  expect(same.status).toBe(304);
  expect(same.headers.get("ETag")).toBe(etag);
  expect(await same.text()).toBe("");
  const weak = await app.request(ICON, {
    headers: { "If-None-Match": `"other", W/${etag}` },
  });
  expect(weak.status).toBe(304);
  const stale = await app.request(ICON, {
    headers: { "If-None-Match": '"stale"' },
  });
  expect(stale.status).toBe(200);
});

test("a missing icon, a bad path and an unknown profile are all 404", async () => {
  const app = await withPackedIcon();
  for (const path of [
    "/icons/emerald-us-1.0/pokemon/26",
    "/icons/emerald-us-1.0/pokemon/025",
    "/icons/emerald-us-1.0/pokemon/25/shiny/x",
    "/icons/emerald-us-1.0/item/1/shiny",
    "/icons/%2e%2e/pokemon/25",
    "/icons/nope/pokemon/25",
    "/icons/emerald-us-1.0",
    "/icons",
  ]) {
    const response = await app.request(path);
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).not.toBe("image/png");
  }
});

test("with mode off the route is a 404 even when the pack has the file", async () => {
  const dir = join(paths().iconsFolder, "pokemon", "emerald");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "25.png"), PNG);
  const app = createApp({
    resources: idle,
    icons: iconService("off"),
    listening: () => ({ host: "127.0.0.1", port: PORT }),
  });
  expect((await app.request(ICON)).status).toBe(404);
});

test("without an icon service there is no icons route", async () => {
  const app = createApp({ resources: idle });
  expect((await app.request(ICON)).status).toBe(404);
});

test("GET /adapters answers the last known list, and a bad switch body is invalid_request", async () => {
  const app = await everything();
  const list = await app.request("/adapters", { headers: { Host: HOST } }, lan);
  expect(list.status).toBe(200);
  expect(adaptersBody.parse(await list.json()).mode).toBe("auto");
  const bad = await app.request(
    "/adapters/switch",
    { ...put({ id: "nope" }), method: "POST" },
    loopback,
  );
  expect(bad.status).toBe(400);
  const post = { ...put({ id: "mgba" }), method: "POST" };
  const refused = await app.request("/adapters/switch", post, loopback);
  expect(internalErrorBody.parse(await refused.json()).error.code).toBe(
    "adapter_not_usable",
  );
});

test("POST /adapters/probe returns the list body and needs the write guard", async () => {
  const app = await everything();
  const post = { ...put({}), method: "POST" };
  const ok = await app.request("/adapters/probe", post, loopback);
  expect(ok.status).toBe(200);
  expect(adaptersBody.parse(await ok.json()).mode).toBe("auto");
  const lanPeer = await app.request("/adapters/probe", post, lan);
  expect(lanPeer.status).toBe(403);
});

// Update route

test("GET /update is an open read that answers the last check and never calls the feed", async () => {
  const { checker, requests } = updateChecker();
  const app = createApp({ resources: idle, update: checker });
  const ask = async () => {
    const response = await app.request(
      "/update",
      { headers: { Host: "192.168.1.5:7425" } },
      lan,
    );
    expect(response.status).toBe(200);
    return updateBody.parse(await response.json());
  };
  expect(await ask()).toEqual({
    enabled: true,
    current: "2.0.0",
    latest: null,
    checkedAt: null,
  });
  expect(requests).toHaveLength(0);

  await checker.checkNow();
  expect(requests).toHaveLength(1);
  const found = await ask();
  expect(found.latest).toEqual({
    version: "2.1.0",
    url: RELEASE.html_url,
  });
  expect(found.checkedAt).not.toBeNull();
  expect(requests).toHaveLength(1);
});

test("GET /update with updateCheck off is enabled false and latest null, and the route has no write method", async () => {
  const { checker } = updateChecker(false);
  const app = createApp({ resources: idle, update: checker });
  const response = await app.request("/update", {}, lan);
  expect(updateBody.parse(await response.json())).toEqual({
    enabled: false,
    current: "2.0.0",
    latest: null,
    checkedAt: null,
  });
  for (const method of ["POST", "PUT", "DELETE"])
    expect(
      (await app.request("/update", { method, body: "{}" }, loopback)).status,
    ).toBe(404);
});

test("there is no /update route without an update checker", async () => {
  const response = await createApp({ resources: idle }).request("/update");
  expect(response.status).toBe(404);
});

test("a settings save that flips updateCheck reaches the checker", async () => {
  const { checker, requests, clock } = updateChecker();
  const config = await loadConfig();
  followUpdateSetting(config, checker, true);
  const app = createApp({
    resources: idle,
    config,
    update: checker,
    listening: () => ({ host: "127.0.0.1", port: PORT }),
  });
  const ask = async () =>
    updateBody.parse(await (await app.request("/update", {}, lan)).json());

  const off = await app.request(
    "/settings",
    put({ updateCheck: false }),
    loopback,
  );
  expect(off.status).toBe(200);
  expect((await ask()).enabled).toBe(false);
  clock.advance(60_000);
  expect(requests).toHaveLength(0);

  await app.request("/settings", put({ updateCheck: true }), loopback);
  expect((await ask()).enabled).toBe(true);
  clock.advance(5000);
  expect(requests).toHaveLength(1);
});

// Manual picks

const postJson = (body: unknown, headers: Record<string, string> = {}) => ({
  ...put(body, headers),
  method: "POST",
});

test("POST /manual-picks answers the server's pick body, and a bad body is invalid_request", async () => {
  const app = await everything();
  const ok = await app.request(
    "/manual-picks",
    postJson({ profileId: "emerald", scope: "rom" }),
    loopback,
  );
  expect(ok.status).toBe(200);
  expect(pickBody.parse(await ok.json()).key).toBe("sha1:abc");
  for (const bad of [
    {},
    { profileId: "emerald" },
    { profileId: "", scope: "rom" },
    { profileId: "e", scope: "all" },
  ]) {
    const response = await app.request(
      "/manual-picks",
      postJson(bad),
      loopback,
    );
    expect(response.status).toBe(400);
    expect(internalErrorBody.parse(await response.json()).error.code).toBe(
      "invalid_request",
    );
  }
});

test("GET /manual-picks is an open read that answers the candidates body to a LAN peer", async () => {
  const app = await everything();
  const response = await app.request(
    "/manual-picks",
    { headers: { Host: "192.168.1.5:7425" } },
    lan,
  );
  expect(response.status).toBe(200);
  expect(manualPicksBody.parse(await response.json())).toEqual(LISTED);
});

test("POST /manual-picks/forget answers an empty body, and a loop refusal keeps its code", async () => {
  const app = await everything();
  const ok = await app.request("/manual-picks/forget", postJson({}), loopback);
  expect(ok.status).toBe(200);
  expect(await ok.json()).toEqual({});
  const refusing = createApp({
    resources: idle,
    config: await loadConfig(),
    picks: {
      ...picksStub,
      forget: () =>
        Promise.resolve({
          ok: false,
          code: "forget_not_allowed",
          message: "No pick to forget.",
        } as const),
    },
    listening: () => ({ host: "127.0.0.1", port: PORT }),
  });
  const refused = await refusing.request(
    "/manual-picks/forget",
    postJson({}),
    loopback,
  );
  expect(refused.status).toBe(409);
  expect(internalErrorBody.parse(await refused.json()).error.code).toBe(
    "forget_not_allowed",
  );
});

test.each([
  ["/manual-picks", { profileId: "emerald", scope: "rom" }],
  ["/manual-picks/forget", {}],
])(
  "a write to %s without the guard is refused and never reaches the loop",
  async (path, body) => {
    let calls = 0;
    const app = createApp({
      resources: idle,
      config: await loadConfig(),
      picks: {
        pickList: picksStub.pickList,
        pick: () => {
          calls += 1;
          return picksStub.pick();
        },
        forget: () => {
          calls += 1;
          return picksStub.forget();
        },
      },
      listening: () => ({ host: "127.0.0.1", port: PORT }),
    });
    const attempts = [
      [postJson(body), lan],
      [postJson(body, { Host: "evil.example:7425" }), loopback],
      [postJson(body, { "Content-Type": "text/plain" }), loopback],
      [postJson(body, { Origin: "http://evil.example" }), loopback],
    ] as const;
    for (const [init, env] of attempts) {
      const response = await app.request(path, init, env);
      expect(response.status).toBe(403);
      expect(internalErrorBody.parse(await response.json()).error.code).toBe(
        "write_forbidden",
      );
    }
    expect(calls).toBe(0);
  },
);

test("without a picks dependency the manual-picks routes do not exist", async () => {
  const app = createApp({
    resources: idle,
    config: await loadConfig(),
    listening: () => ({ host: "127.0.0.1", port: PORT }),
  });
  const response = await app.request(
    "/manual-picks",
    postJson({ profileId: "emerald", scope: "rom" }),
    loopback,
  );
  expect(response.status).toBe(404);
});
