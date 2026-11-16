import { expect, test } from "bun:test";
import type { Log } from "../log";
import { builtinProfiles } from "./builtin/index";
import { loadStartupProfiles } from "./startup";

function recordingLog(): { log: Log; warnings: string[] } {
  const warnings: string[] = [];
  const log: Log = {
    debug() {},
    info() {},
    error() {},
    warn: (message) => warnings.push(message),
  };
  return { log, warnings };
}

function loaded(result: ReturnType<typeof loadStartupProfiles>) {
  if (!result.ok) throw new Error(result.message);
  return result.registry;
}

test("startup loads emerald-us-1.0 into the registry", () => {
  const { log, warnings } = recordingLog();
  const registry = loaded(
    loadStartupProfiles({ builtin: builtinProfiles, user: [] }, log),
  );
  expect(registry.get("emerald-us-1.0")?.id).toBe("emerald-us-1.0");
  expect(warnings).toEqual([]);
});

test("a broken built-in profile fails startup with its ID and the reason", () => {
  const { log } = recordingLog();
  const broken = { ...(builtinProfiles[0] as object), dataFormat: "gen9" };
  const result = loadStartupProfiles({ builtin: [broken], user: [] }, log);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.message).toStartWith("Built-in profile failed to load");
  expect(result.message).toContain("builtin:emerald-us-1.0");
});

test("a built-in profile without a fixture fails startup", () => {
  const { log } = recordingLog();
  const { fixture: _fixture, ...noFixture } = builtinProfiles[0] as Record<
    string,
    unknown
  >;
  const result = loadStartupProfiles({ builtin: [noFixture], user: [] }, log);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.message).toContain("must state its fixture");
});

test("a bad user profile is logged and startup goes on", () => {
  const { log, warnings } = recordingLog();
  const registry = loaded(
    loadStartupProfiles(
      {
        builtin: builtinProfiles,
        user: [{ path: "mine.json", json: { nonsense: true } }],
      },
      log,
    ),
  );
  expect(registry.get("emerald-us-1.0")).toBeDefined();
  expect(warnings.length).toBe(1);
  expect(warnings[0]).toContain("mine.json");
});
