import { expect, test } from "bun:test";
import {
  CONFIG_VERSION,
  DEFAULT_SETTINGS,
  mergeSettings,
  missingConfig,
  parseConfigText,
} from "./config";

const messages = (text: string) =>
  parseConfigText(text).issues.map((issue) => issue.message);

test("the defaults match the spec", () => {
  expect(DEFAULT_SETTINGS).toEqual({
    configVersion: 1,
    port: 7425,
    host: "127.0.0.1",
    openBrowser: true,
    adapter: "auto",
    adapters: {
      mgba: { host: "127.0.0.1", port: 7426 },
      retroarch: { host: "127.0.0.1", port: 55355 },
      bizhawk: { host: "127.0.0.1", port: 7427 },
    },
    pollHz: 20,
    updateCheck: true,
    icons: { mode: "online", baseUrl: null },
  });
  expect(missingConfig().refusal).toBeNull();
});

test("an empty object is the defaults with no warnings", () => {
  const parsed = parseConfigText("{}");
  expect(parsed.settings).toEqual(DEFAULT_SETTINGS);
  expect(parsed.issues).toEqual([]);
  expect(parsed.refusal).toBeNull();
  expect(parsed.present.size).toBe(0);
});

test("a valid file overrides the defaults key by key, including inside adapters", () => {
  const parsed = parseConfigText(
    JSON.stringify({
      configVersion: 1,
      port: 8000,
      host: "0.0.0.0",
      openBrowser: false,
      adapter: "retroarch",
      adapters: { mgba: { port: 9000 }, retroarch: { host: "10.0.0.5" } },
      pollHz: 30,
      updateCheck: false,
      icons: { mode: "local", baseUrl: "https://mirror.example/sprites" },
    }),
  );
  expect(parsed.issues).toEqual([]);
  expect(parsed.settings).toEqual({
    configVersion: 1,
    port: 8000,
    host: "0.0.0.0",
    openBrowser: false,
    adapter: "retroarch",
    adapters: {
      mgba: { host: "127.0.0.1", port: 9000 },
      retroarch: { host: "10.0.0.5", port: 55355 },
      bizhawk: { host: "127.0.0.1", port: 7427 },
    },
    pollHz: 30,
    updateCheck: false,
    icons: { mode: "local", baseUrl: "https://mirror.example/sprites" },
  });
  expect([...parsed.present].sort()).toEqual([
    "adapter",
    "adapters",
    "configVersion",
    "host",
    "icons",
    "openBrowser",
    "pollHz",
    "port",
    "updateCheck",
  ]);
});

test("a key with an invalid value falls back to its default with one warning, and the rest still load", () => {
  const parsed = parseConfigText(
    JSON.stringify({
      port: 70000,
      host: "",
      openBrowser: "yes",
      adapter: "dolphin",
      adapters: { mgba: { port: "7426" }, bizhawk: { port: 1234 } },
      updateCheck: false,
      icons: { mode: "everywhere", baseUrl: "ftp://mirror.example" },
    }),
  );
  expect(parsed.settings).toEqual({
    ...DEFAULT_SETTINGS,
    adapters: {
      ...DEFAULT_SETTINGS.adapters,
      bizhawk: { host: "127.0.0.1", port: 1234 },
    },
    updateCheck: false,
  });
  expect(parsed.issues.map((issue) => issue.message.split(" ")[0])).toEqual([
    "port",
    "host",
    "openBrowser",
    "adapter",
    "adapters.mgba.port",
    "icons.mode",
    "icons.baseUrl",
  ]);
  expect(parsed.present.has("port")).toBe(false);
  expect(parsed.refusal).toBeNull();
});

test("a section that isn't an object warns and uses the defaults", () => {
  const parsed = parseConfigText('{"adapters": 5, "icons": []}');
  expect(parsed.settings).toEqual(DEFAULT_SETTINGS);
  expect(messages('{"adapters": 5}')).toEqual([
    "adapters must be an object, using the defaults",
  ]);
  expect(parsed.issues).toHaveLength(2);
});

test("pollHz clamps an out-of-range integer and falls back on anything else", () => {
  const settings = (value: unknown) =>
    parseConfigText(JSON.stringify({ pollHz: value }));
  expect(settings(1).settings.pollHz).toBe(5);
  expect(settings(500).settings.pollHz).toBe(60);
  expect(messages('{"pollHz": 500}')).toEqual([
    "pollHz 500 is out of range, using 60",
  ]);
  expect(settings(30).issues).toEqual([]);
  for (const bad of [2.5, "20", null, true]) {
    const parsed = settings(bad);
    expect(parsed.settings.pollHz).toBe(20);
    expect(parsed.issues).toHaveLength(1);
  }
});

test("unknown keys warn once, listing every one, and are kept for saves", () => {
  const parsed = parseConfigText(
    JSON.stringify({
      port: 8000,
      theme: "dark",
      adapters: { mgba: { tls: 1 } },
    }),
  );
  expect(parsed.settings.port).toBe(8000);
  expect(parsed.issues).toEqual([
    {
      level: "warn",
      message:
        "unknown keys adapters.mgba.tls, theme are ignored and kept on save",
    },
  ]);
  expect(parsed.unknown).toEqual({
    theme: "dark",
    adapters: { mgba: { tls: 1 } },
  });
  expect(parsed.refusal).toBeNull();
});

test.each([["not json at all"], ["{"], [""], ["[1, 2]"], ["null"], ['"text"']])(
  "%j is malformed: an error, the defaults and no saves",
  (text) => {
    const parsed = parseConfigText(text);
    expect(parsed.settings).toEqual(DEFAULT_SETTINGS);
    expect(parsed.refusal).toBe("malformed");
    expect(parsed.issues).toHaveLength(1);
    expect(parsed.issues[0]?.level).toBe("error");
  },
);

test("a newer configVersion runs on the keys it understands and refuses saves", () => {
  const parsed = parseConfigText(
    JSON.stringify({
      configVersion: CONFIG_VERSION + 1,
      port: 8000,
      futureKey: true,
    }),
  );
  expect(parsed.settings.port).toBe(8000);
  expect(parsed.refusal).toBe("newer-version");
  expect(parsed.issues).toHaveLength(1);
  expect(parsed.issues[0]?.message).toContain("newer than this build's 1");
  expect(parsed.unknown).toEqual({ futureKey: true });
});

test("an invalid configVersion warns and does not refuse saves", () => {
  const parsed = parseConfigText('{"configVersion": "one"}');
  expect(parsed.settings.configVersion).toBe(1);
  expect(parsed.refusal).toBeNull();
  expect(parsed.issues).toHaveLength(1);
});

test("mergeSettings patches one level into adapters and icons without touching the rest", () => {
  const merged = mergeSettings(DEFAULT_SETTINGS, {
    pollHz: 40,
    adapters: { mgba: { port: 9000 } },
    icons: { baseUrl: "http://mirror.example" },
  });
  expect(merged.pollHz).toBe(40);
  expect(merged.adapters.mgba).toEqual({ host: "127.0.0.1", port: 9000 });
  expect(merged.adapters.retroarch).toEqual(
    DEFAULT_SETTINGS.adapters.retroarch,
  );
  expect(merged.icons).toEqual({
    mode: "online",
    baseUrl: "http://mirror.example",
  });
  expect(DEFAULT_SETTINGS.pollHz).toBe(20);
});
