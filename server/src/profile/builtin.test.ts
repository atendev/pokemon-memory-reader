import { expect, test } from "bun:test";
import { builtinProfiles } from "./builtin/index";
import { loadProfiles } from "./registry";

test("every built-in profile loads without a problem", () => {
  const { registry, problems } = loadProfiles({
    builtin: builtinProfiles,
    user: [],
  });
  expect(problems).toEqual([]);
  expect(registry.all().length).toBe(builtinProfiles.length);
});

test("every built-in official profile has both hashes and a provenance record", () => {
  const { registry } = loadProfiles({ builtin: builtinProfiles, user: [] });
  for (const profile of registry.all().filter((p) => p.kind === "official")) {
    expect(profile.identify?.sha1.length).toBeGreaterThan(0);
    expect(profile.identify?.crc32.length).toBeGreaterThan(0);
    expect(profile.provenance).not.toBeNull();
  }
});

test("Emerald identifies by hash and by header", () => {
  const { registry } = loadProfiles({ builtin: builtinProfiles, user: [] });
  const byCrc = registry.byHash({ crc32: "1F1C08FB", sha1: null });
  expect(byCrc.map((p) => p.id)).toEqual(["emerald-us-1.0"]);
  expect(registry.byHash({ crc32: "00000000", sha1: null })).toEqual([]);
  const byHeader = registry.byHeader({
    platform: "gba",
    title: "POKEMON EMER",
    gameCode: "BPEE",
    revision: 0,
  });
  expect(byHeader.map((p) => p.id)).toEqual(["emerald-us-1.0"]);
  expect(
    registry.byHeader({
      platform: "gba",
      title: "POKEMON EMER",
      gameCode: "BPEE",
      revision: 1,
    }),
  ).toEqual([]);
});
