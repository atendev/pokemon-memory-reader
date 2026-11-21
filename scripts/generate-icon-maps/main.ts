import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ICON_SPRITES_SHA } from "../../server/src/icons/source";
import gen3 from "../../server/src/reference/data/gen3-en.json";
import { buildIconMaps, readPokeApi, renderIconMaps } from "./build";

/** The PokeAPI/pokeapi commit the CSV data is read at, so a rerun builds the same tables. */
const POKEAPI_COMMIT = "cd5f6c6232f23430aa6089896d96230f5f7ecef4";

const OUT = join(import.meta.dir, "../../server/src/icons/data/icon-maps.json");

async function fetchOk(url: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response;
}

const csv = async (name: string) =>
  (
    await fetchOk(
      `https://raw.githubusercontent.com/PokeAPI/pokeapi/${POKEAPI_COMMIT}/data/v2/csv/${name}.csv`,
    )
  ).text();

/** File names under `sprites/items/` at the pinned sprites SHA. jsDelivr refuses to list this repo, so GitHub's tree API does. */
async function itemSprites(): Promise<Set<string>> {
  const token = process.env.GITHUB_TOKEN;
  const response = await fetchOk(
    `https://api.github.com/repos/PokeAPI/sprites/git/trees/${ICON_SPRITES_SHA}:sprites/items`,
    token ? { authorization: `Bearer ${token}` } : {},
  );
  const listing = (await response.json()) as {
    truncated: boolean;
    tree: { path: string; type: string }[];
  };
  if (listing.truncated)
    throw new Error("the sprites/items listing is cut off");
  return new Set(
    listing.tree.flatMap((entry) =>
      entry.type === "blob" && entry.path.endsWith(".png")
        ? [entry.path.slice(0, -".png".length)]
        : [],
    ),
  );
}

// Fetch and build everything first so a failed fetch or a disagreement never leaves the committed output half written.
const [items, item_names, item_game_indices, versions, pokemon_game_indices] =
  await Promise.all([
    csv("items"),
    csv("item_names"),
    csv("item_game_indices"),
    csv("versions"),
    csv("pokemon_game_indices"),
  ]);
const file = buildIconMaps({
  pokeapi: readPokeApi(
    { items, item_names, item_game_indices, versions, pokemon_game_indices },
    await itemSprites(),
  ),
  gen3ItemNames: gen3.names.items,
  spritesSha: ICON_SPRITES_SHA,
  pokeapiCommit: POKEAPI_COMMIT,
});
await writeFile(OUT, renderIconMaps(file));
