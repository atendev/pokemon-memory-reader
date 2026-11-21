import { expect, test } from "bun:test";
import {
  buildIconMaps,
  type IconMapsInput,
  parseCsv,
  readPokeApi,
  renderIconMaps,
} from "./build";

/** Hand-written rows in PokeAPI's CSV shapes. None of it is copied from PokeAPI. */
const files = {
  items:
    "id,identifier,category_id\n1,master-ball,34\n2,potion,27\n3,dowsing-machine,22\n4,basement-key,22\n5,no-art,1\n6,tm01,3",
  item_names:
    'item_id,local_language_id,name\n1,9,Master Ball\n2,9,Potion\n2,5,"Potion, fr"\n3,9,Dowsing Machine\n6,9,TM01',
  item_game_indices:
    "item_id,generation_id,game_index\n1,1,1\n2,1,20\n5,1,30\n1,3,1\n2,3,13\n3,3,261\n4,3,261\n5,3,7\n2,2,20\n3,2,9\n4,2,9",
  versions:
    "id,version_group_id,identifier\n1,1,red\n2,1,blue\n3,2,yellow\n4,3,gold\n5,3,silver\n6,4,crystal",
  pokemon_game_indices:
    "pokemon_id,version_id,game_index\n1,1,153\n1,2,153\n1,3,153\n25,1,84\n25,2,84\n25,3,84\n1,4,1\n1,5,1\n1,6,1\n2,4,2\n2,5,2\n2,6,2\n1025,4,3\n1025,5,3\n1025,6,3",
};
const sprites = new Set(["master-ball", "potion", "dowsing-machine", "tm01"]);
const input = (over: Partial<IconMapsInput> = {}): IconMapsInput => ({
  pokeapi: readPokeApi(files, sprites),
  gen3ItemNames: [
    null,
    "MASTER BALL",
    null,
    "????????",
    null,
    null,
    null,
    "X",
    null,
    null,
    null,
    null,
    null,
    "POTION",
    ...Array(247).fill(null),
    "ITEMFINDER",
  ],
  spritesSha: "sprites",
  pokeapiCommit: "pokeapi",
  ...over,
});

test("parseCsv reads quoted commas", () => {
  expect(parseCsv('a,b\n1,"x, ""y"""')).toEqual([{ a: "1", b: 'x, "y"' }]);
});

test("Gen 1 and Gen 2 tables follow their generation's game_index, with art only", () => {
  const { items } = buildIconMaps(input());
  expect(items["red-blue"]).toEqual({ 1: "master-ball", 20: "potion" });
  expect(items.yellow).toEqual(items["red-blue"]);
  // Index 9 lists two items and Gen 2 has no names to pick, so it is left out.
  expect(items.crystal).toEqual({ 20: "potion" });
});

test("Gen 3 tables keep real game items and let the name settle a shared index", () => {
  const { items } = buildIconMaps(input());
  // 3 is a ????? filler, 7 has no art, and 261 lists two items, ITEMFINDER picks one.
  expect(items.emerald).toEqual({
    1: "master-ball",
    13: "potion",
    261: "dowsing-machine",
  });
  expect(items["firered-leafgreen"]).toEqual(items.emerald);
});

test("the species tables map internal ID to dex and skip alternate forms", () => {
  const { dex } = buildIconMaps(input());
  expect(dex.gen1).toEqual({ 84: 25, 153: 1 });
  expect(dex.gen2).toEqual({ 1: 1, 2: 2 });
});

test("games of one generation that number species apart fail the build", () => {
  const split = readPokeApi(
    { ...files, pokemon_game_indices: `${files.pokemon_game_indices}\n2,3,99` },
    sprites,
  );
  expect(() => buildIconMaps(input({ pokeapi: split }))).toThrow(
    /red and yellow/,
  );
});

test("a rerun gives the same text", () => {
  expect(renderIconMaps(buildIconMaps(input()))).toBe(
    renderIconMaps(buildIconMaps(input())),
  );
});
