import { TYPES } from "@pokemon-memory-reader/api/schemas";
import type { Profile } from "../profile/schema";
import type { IconKey } from "./keys";
import { ITEM_SLUGS } from "./maps";
import { DEFAULT_MAPS, type IconMaps, planIcon } from "./plan";

/** One official game per art version, enough for `planIcon` to pick its art folders. */
const GAMES: ReadonlyArray<Pick<Profile, "artVersion" | "dataFormat">> = [
  { artVersion: "red-blue", dataFormat: "gen1" },
  { artVersion: "red-green-japan", dataFormat: "gen1" },
  { artVersion: "yellow", dataFormat: "gen1" },
  { artVersion: "gold", dataFormat: "gen2" },
  { artVersion: "silver", dataFormat: "gen2" },
  { artVersion: "crystal", dataFormat: "gen2" },
  { artVersion: "ruby-sapphire", dataFormat: "gen3" },
  { artVersion: "emerald", dataFormat: "gen3" },
  { artVersion: "firered-leafgreen", dataFormat: "gen3" },
];

/** The largest internal species ID of any Gen 1-3 game. Gen 3 skips 252-276 and ends at 411. */
const LAST_SPECIES = 411;

/**
 * Every upstream path the maps can send a request to, under the source's `sprites/` folder, sorted
 * and without repeats. `check-icon-map` sends a HEAD request for each (spec §11.9).
 */
export function mappedUpstreamPaths(maps: IconMaps = DEFAULT_MAPS): string[] {
  const paths = new Set<string>();
  for (const game of GAMES) {
    const profile = {
      ...game,
      id: game.artVersion,
      kind: "official",
      language: "en",
    } as unknown as Profile;
    const keys: IconKey[] = [];
    for (let id = 1; id <= LAST_SPECIES; id++) {
      const base = { profileId: profile.id, id };
      keys.push(
        { kind: "pokemon", shiny: false, ...base },
        { kind: "pokemon", shiny: true, ...base },
        { kind: "icon", ...base },
      );
    }
    for (const id of Object.keys(ITEM_SLUGS[game.artVersion]))
      keys.push({ kind: "item", profileId: profile.id, id: Number(id) });
    for (const typeName of TYPES)
      keys.push({ kind: "type", profileId: profile.id, typeName });
    for (const key of keys) {
      const upstream = planIcon(profile, key, maps)?.upstream;
      if (upstream) paths.add(upstream);
    }
  }
  return [...paths].sort();
}
