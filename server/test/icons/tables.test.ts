import { expect, test } from "bun:test";
import { mappedUpstreamPaths } from "../../src/icons/coverage";
import type { IconKey } from "../../src/icons/keys";
import { GEN1_DEX, GEN2_DEX, ITEM_SLUGS } from "../../src/icons/maps";
import { planIcon } from "../../src/icons/plan";
import { builtinProfiles } from "../../src/profile/builtin/index";
import { loadProfiles } from "../../src/profile/registry";
import type { Profile } from "../../src/profile/schema";

const { registry } = loadProfiles({ builtin: builtinProfiles, user: [] });
const as = (patch: Record<string, unknown>) =>
  ({
    ...(registry.get("emerald-us-1.0") as Profile),
    ...patch,
  }) as unknown as Profile;
const item = (id: number): IconKey => ({ kind: "item", profileId: "x", id });
const pokemon = (id: number): IconKey => ({
  kind: "pokemon",
  profileId: "x",
  id,
  shiny: false,
});

test("Emerald, FireRed and LeafGreen items resolve to their art", () => {
  for (const id of ["emerald-us-1.0", "firered-us-1.0", "leafgreen-us-1.0"]) {
    const profile = registry.get(id) as Profile;
    expect(planIcon(profile, item(4))).toEqual({
      pack: ["item/poke-ball.png"],
      upstream: "items/poke-ball.png",
    });
    expect(planIcon(profile, item(289))?.upstream).toBe("items/tm01.png");
  }
});

test("items without art or without a mapping answer 404", () => {
  const emerald = registry.get("emerald-us-1.0") as Profile;
  expect(planIcon(emerald, item(0))).toBeNull();
  expect(planIcon(emerald, item(52))).toBeNull();
  expect(planIcon(emerald, item(60000))).toBeNull();
});

test("Gen 1 and Gen 2 items follow their own generation's IDs", () => {
  expect(
    planIcon(as({ dataFormat: "gen1", artVersion: "yellow" }), item(1)),
  ).toEqual({
    pack: ["item/master-ball.png"],
    upstream: "items/master-ball.png",
  });
  expect(
    planIcon(as({ dataFormat: "gen2", artVersion: "crystal" }), item(1)),
  ).toEqual({
    pack: ["item/master-ball.png"],
    upstream: "items/master-ball.png",
  });
});

test("Gen 1 species map from the cartridge's internal order to the dex", () => {
  const red = as({ id: "red", dataFormat: "gen1", artVersion: "red-blue" });
  // Internal 0x99 is Bulbasaur, 0x54 is Pikachu and 0x01 is Rhydon.
  expect(planIcon(red, pokemon(153))?.upstream).toBe(
    "pokemon/versions/generation-i/red-blue/transparent/1.png",
  );
  expect(planIcon(red, pokemon(84))?.upstream).toBe(
    "pokemon/versions/generation-i/red-blue/transparent/25.png",
  );
  expect(planIcon(red, pokemon(1))?.upstream).toBe(
    "pokemon/versions/generation-i/red-blue/transparent/112.png",
  );
  // 0 and the gaps in the cartridge's table hold no species.
  expect(planIcon(red, pokemon(0))).toBeNull();
  expect(planIcon(red, pokemon(31))).toBeNull();
  expect(planIcon(red, pokemon(191))).toBeNull();
});

test("Gen 2 species ARE their dex number, 1 to 251", () => {
  const crystal = as({
    id: "crystal",
    dataFormat: "gen2",
    artVersion: "crystal",
  });
  expect(planIcon(crystal, pokemon(251))?.upstream).toBe(
    "pokemon/versions/generation-ii/crystal/transparent/251.png",
  );
  expect(planIcon(crystal, pokemon(252))).toBeNull();
  expect(planIcon(crystal, pokemon(0))).toBeNull();
});

test("the generated dex tables have the right shape", () => {
  expect(Object.keys(GEN1_DEX)).toHaveLength(151);
  expect(new Set(Object.values(GEN1_DEX))).toEqual(
    new Set(Array.from({ length: 151 }, (_, i) => i + 1)),
  );
  expect(Object.keys(GEN2_DEX)).toHaveLength(251);
  for (const [id, dex] of Object.entries(GEN2_DEX))
    expect(dex).toBe(Number(id));
});

test("the generated item tables have the right shape", () => {
  for (const table of Object.values(ITEM_SLUGS)) {
    expect(Object.keys(table).length).toBeGreaterThan(100);
    for (const [id, slug] of Object.entries(table)) {
      expect(Number.isInteger(Number(id))).toBe(true);
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  }
  // Ruby, Sapphire, Emerald, FireRed and LeafGreen share one generation-3 item index.
  expect(ITEM_SLUGS["ruby-sapphire"]).toEqual(ITEM_SLUGS.emerald);
  expect(ITEM_SLUGS["firered-leafgreen"]).toEqual(ITEM_SLUGS.emerald);
});

test("the coverage list is deterministic, unique and offline", () => {
  const paths = mappedUpstreamPaths();
  expect(paths).toEqual(mappedUpstreamPaths());
  expect(new Set(paths).size).toBe(paths.length);
  expect(paths).toContain("items/poke-ball.png");
  expect(paths).toContain(
    "pokemon/versions/generation-i/red-blue/transparent/112.png",
  );
  expect(paths).toContain(
    "pokemon/versions/generation-ii/gold/transparent/shiny/251.png",
  );
  expect(paths).toContain("pokemon/versions/generation-iii/icons/386.png");
  expect(paths).toContain("types/generation-iii/emerald/10001.png");
  expect(
    paths.some(
      (path) => path.includes("generation-i/") && path.includes("shiny"),
    ),
  ).toBe(false);
  for (const path of paths) expect(path).toMatch(/^[a-z0-9/.-]+\.png$/);
});
