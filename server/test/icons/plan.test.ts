import { expect, test } from "bun:test";
import { TYPES } from "@pokemon-memory-reader/api/schemas";
import type { IconKey } from "../../src/icons/keys";
import { ITEM_SLUGS, POKEAPI_TYPE_IDS } from "../../src/icons/maps";
import { DEFAULT_MAPS, type IconMaps, planIcon } from "../../src/icons/plan";
import { builtinProfiles } from "../../src/profile/builtin/index";
import { loadProfiles } from "../../src/profile/registry";
import type { Profile } from "../../src/profile/schema";

const { registry } = loadProfiles({ builtin: builtinProfiles, user: [] });
const emerald = registry.get("emerald-us-1.0") as Profile;

const as = (patch: Record<string, unknown>) =>
  ({ ...emerald, ...patch }) as unknown as Profile;
const hack = as({ id: "radical-red", kind: "hack", dataFormat: "cfru" });
const gen2 = as({ id: "crystal", dataFormat: "gen2", artVersion: "crystal" });
const gen1 = as({ id: "red", dataFormat: "gen1", artVersion: "red-blue" });
const gen1Japan = as({
  id: "red-jp",
  dataFormat: "gen1",
  artVersion: "red-green-japan",
});

const maps: IconMaps = {
  ...DEFAULT_MAPS,
  itemSlug: (_art, id) => (id === 4 ? "poke-ball" : null),
};
const pokemon = (id: number, shiny = false): IconKey => ({
  kind: "pokemon",
  profileId: "x",
  id,
  shiny,
});

test("Emerald card sprite, shiny sprite and menu icon", () => {
  expect(planIcon(emerald, pokemon(25))).toEqual({
    pack: ["pokemon/emerald/25.png"],
    upstream: "pokemon/versions/generation-iii/emerald/25.png",
  });
  expect(planIcon(emerald, pokemon(25, true))).toEqual({
    pack: ["pokemon/emerald/shiny/25.png"],
    upstream: "pokemon/versions/generation-iii/emerald/shiny/25.png",
  });
  expect(planIcon(emerald, { kind: "icon", profileId: "x", id: 25 })).toEqual({
    pack: ["icon/25.png"],
    upstream: "pokemon/versions/generation-iii/icons/25.png",
  });
});

test("an internal species id maps to its dex number", () => {
  // Treecko is internal 277 and dex 252, Chimecho internal 411 and dex 358.
  expect(planIcon(emerald, pokemon(277))?.upstream).toEndWith("/252.png");
  expect(planIcon(emerald, pokemon(411))?.upstream).toEndWith("/358.png");
});

test("an unmapped species is null, including the Gen 3 placeholder slots and id 0", () => {
  for (const id of [0, 252, 276, 412, 65535])
    expect(planIcon(emerald, pokemon(id))).toBeNull();
});

test("Gen 1 and Gen 2 sprites use transparent/ except red-green-japan, and Gen 1 has no shiny", () => {
  // Gen 1 and Gen 2 reference data ships later, so a dex-less format maps nothing yet.
  const twoMaps: IconMaps = { ...maps, dex: (_p, id) => id };
  expect(planIcon(gen2, pokemon(25), twoMaps)).toEqual({
    pack: ["pokemon/crystal/25.png"],
    upstream: "pokemon/versions/generation-ii/crystal/transparent/25.png",
  });
  expect(planIcon(gen2, pokemon(25, true), twoMaps)?.upstream).toBe(
    "pokemon/versions/generation-ii/crystal/transparent/shiny/25.png",
  );
  expect(planIcon(gen1, pokemon(25), twoMaps)?.upstream).toBe(
    "pokemon/versions/generation-i/red-blue/transparent/25.png",
  );
  expect(planIcon(gen1Japan, pokemon(25), twoMaps)?.upstream).toBe(
    "pokemon/versions/generation-i/red-green-japan/25.png",
  );
  expect(planIcon(gen1, pokemon(25, true), twoMaps)).toBeNull();
});

test("Gen 1 and Gen 2 menu icons are the Gen 3 icons", () => {
  const twoMaps: IconMaps = { ...maps, dex: (_p, id) => id };
  expect(
    planIcon(gen1, { kind: "icon", profileId: "x", id: 151 }, twoMaps),
  ).toEqual({
    pack: ["icon/151.png"],
    upstream: "pokemon/versions/generation-iii/icons/151.png",
  });
});

test("types use the running version's folder, and Gen 1-2 use firered-leafgreen", () => {
  const fire: IconKey = { kind: "type", profileId: "x", typeName: "fire" };
  expect(planIcon(emerald, fire)).toEqual({
    pack: ["type/emerald/fire.png"],
    upstream: "types/generation-iii/emerald/10.png",
  });
  expect(planIcon(gen2, fire)).toEqual({
    pack: ["type/firered-leafgreen/fire.png"],
    upstream: "types/generation-iii/firered-leafgreen/10.png",
  });
  expect(planIcon(gen1, fire)?.upstream).toBe(
    "types/generation-iii/firered-leafgreen/10.png",
  );
});

test("the ??? type is mystery on the route, 10001 upstream and unknown in the pack", () => {
  expect(
    planIcon(emerald, { kind: "type", profileId: "x", typeName: "mystery" }),
  ).toEqual({
    pack: ["type/emerald/unknown.png"],
    upstream: "types/generation-iii/emerald/10001.png",
  });
});

test("fairy has no Gen 3 icon, so it is unmapped", () => {
  expect(
    planIcon(emerald, { kind: "type", profileId: "x", typeName: "fairy" }),
  ).toBeNull();
});

test("items use the slug table for the art version, and an unmapped id is null", () => {
  expect(
    planIcon(emerald, { kind: "item", profileId: "x", id: 4 }, maps),
  ).toEqual({ pack: ["item/poke-ball.png"], upstream: "items/poke-ball.png" });
  expect(
    planIcon(emerald, { kind: "item", profileId: "x", id: 5 }, maps),
  ).toBeNull();
});

test("a hack looks in its own folder first, then the normal path for a vanilla species", () => {
  expect(planIcon(hack, pokemon(25))).toEqual({
    pack: ["hack/radical-red/pokemon/25.png", "pokemon/emerald/25.png"],
    upstream: "pokemon/versions/generation-iii/emerald/25.png",
  });
  expect(planIcon(hack, pokemon(277, true))).toEqual({
    pack: [
      "hack/radical-red/pokemon/shiny/277.png",
      "pokemon/emerald/shiny/252.png",
    ],
    upstream: "pokemon/versions/generation-iii/emerald/shiny/252.png",
  });
  expect(planIcon(hack, { kind: "icon", profileId: "x", id: 25 })).toEqual({
    pack: ["hack/radical-red/icon/25.png", "icon/25.png"],
    upstream: "pokemon/versions/generation-iii/icons/25.png",
  });
});

test("a hack species outside 1-251 and 277-411 stops after the hack folder", () => {
  for (const id of [0, 252, 276, 412, 900])
    expect(planIcon(hack, pokemon(id))).toEqual({
      pack: [`hack/radical-red/pokemon/${id}.png`],
      upstream: null,
    });
});

test("a hack item reaches upstream only through a mapped id", () => {
  expect(planIcon(hack, { kind: "item", profileId: "x", id: 4 }, maps)).toEqual(
    {
      pack: ["hack/radical-red/item/4.png", "item/poke-ball.png"],
      upstream: "items/poke-ball.png",
    },
  );
  expect(
    planIcon(hack, { kind: "item", profileId: "x", id: 900 }, maps),
  ).toEqual({ pack: ["hack/radical-red/item/900.png"], upstream: null });
});

test("a hack's types take the normal path", () => {
  expect(
    planIcon(hack, { kind: "type", profileId: "x", typeName: "ice" }),
  ).toEqual({
    pack: ["type/emerald/ice.png"],
    upstream: "types/generation-iii/emerald/15.png",
  });
});

test("the checked-in tables have the right shape", () => {
  expect(Object.keys(POKEAPI_TYPE_IDS).sort()).toEqual([...TYPES].sort());
  for (const id of Object.values(POKEAPI_TYPE_IDS))
    expect(id === null || (Number.isInteger(id) && id > 0)).toBe(true);
  expect(new Set(Object.values(POKEAPI_TYPE_IDS).filter(Boolean)).size).toBe(
    TYPES.length - 1,
  );
  for (const table of Object.values(ITEM_SLUGS))
    for (const [id, slug] of Object.entries(table)) {
      expect(Number(id)).toBeGreaterThanOrEqual(0);
      expect(Number(id)).toBeLessThanOrEqual(65535);
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
});
