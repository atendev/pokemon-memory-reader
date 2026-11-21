import type { Type } from "@pokemon-memory-reader/api/schemas";
import type { Profile } from "../profile/schema";
import { referenceData } from "../reference";
import type { IconKey } from "./keys";
import {
  ITEM_SLUGS,
  isVanillaSpecies,
  POKEAPI_TYPE_IDS,
  TYPE_ART_VERSIONS,
} from "./maps";

/** The ID mapping the plan uses. Tests give small tables, the default is the checked-in one. */
export interface IconMaps {
  /** National Dex number for an internal species ID, or null when the ID has none. */
  dex(profile: Profile, speciesId: number): number | null;
  itemSlug(artVersion: Profile["artVersion"], itemId: number): string | null;
  typeId(type: Type): number | null;
}

export const DEFAULT_MAPS: IconMaps = {
  dex(profile, speciesId) {
    // A hack's species table is its own, so only the vanilla IDs borrow the vanilla Gen 3 dex (spec §11.9).
    if (profile.kind === "hack")
      return isVanillaSpecies(speciesId)
        ? (referenceData("gen3", "en")?.speciesData.dex(speciesId) ?? null)
        : null;
    return (
      referenceData(profile.dataFormat, profile.language)?.speciesData.dex(
        speciesId,
      ) ?? null
    );
  },
  itemSlug: (artVersion, itemId) => ITEM_SLUGS[artVersion][itemId] ?? null,
  typeId: (type) => POKEAPI_TYPE_IDS[type],
};

/**
 * Where to look for one icon, in order (spec §11.9, "Lookup order"). `pack` holds paths under the
 * icon pack, tried first and in order. `upstream` is the path under the source's `sprites/` folder,
 * which is also the cache path. It is null when the icon has no upstream art.
 */
export interface IconPlan {
  readonly pack: readonly string[];
  readonly upstream: string | null;
}

const GENERATION: Record<Profile["dataFormat"], string> = {
  gen1: "generation-i",
  gen2: "generation-ii",
  gen3: "generation-iii",
  cfru: "generation-iii",
};

/** Resolves a key against its profile. Null means 404: the ID is unmapped or the combination has no art. */
export function planIcon(
  profile: Profile,
  key: IconKey,
  maps: IconMaps = DEFAULT_MAPS,
): IconPlan | null {
  const hackDir = `hack/${profile.id}`;
  const hack = profile.kind === "hack";
  const { artVersion, dataFormat } = profile;

  /** A hack looks in its own folder first, and goes on to the normal path only when `normal` exists. */
  const withHack = (own: string, normal: IconPlan | null): IconPlan | null => {
    if (!hack) return normal;
    return {
      pack: normal ? [own, ...normal.pack] : [own],
      upstream: normal?.upstream ?? null,
    };
  };

  switch (key.kind) {
    case "pokemon": {
      if (key.shiny && dataFormat === "gen1") return null;
      const dex = maps.dex(profile, key.id);
      const shinyDir = key.shiny ? "shiny/" : "";
      const folder =
        dataFormat === "gen3" || dataFormat === "cfru"
          ? shinyDir
          : artVersion === "red-green-japan"
            ? shinyDir
            : `transparent/${shinyDir}`;
      return withHack(
        `${hackDir}/pokemon/${shinyDir}${key.id}.png`,
        dex === null
          ? null
          : {
              pack: [`pokemon/${artVersion}/${shinyDir}${dex}.png`],
              upstream: `pokemon/versions/${GENERATION[dataFormat]}/${artVersion}/${folder}${dex}.png`,
            },
      );
    }
    case "icon": {
      const dex = maps.dex(profile, key.id);
      return withHack(
        `${hackDir}/icon/${key.id}.png`,
        dex === null
          ? null
          : {
              pack: [`icon/${dex}.png`],
              upstream: `pokemon/versions/generation-iii/icons/${dex}.png`,
            },
      );
    }
    case "item": {
      const slug = maps.itemSlug(artVersion, key.id);
      return withHack(
        `${hackDir}/item/${key.id}.png`,
        slug === null
          ? null
          : { pack: [`item/${slug}.png`], upstream: `items/${slug}.png` },
      );
    }
    case "type": {
      const typeId = maps.typeId(key.typeName);
      const typeArt =
        dataFormat === "gen1" || dataFormat === "gen2"
          ? "firered-leafgreen"
          : artVersion;
      if (typeId === null || !TYPE_ART_VERSIONS.includes(typeArt)) return null;
      // `?` isn't a legal Windows filename character, so the ??? type is `unknown` in the pack.
      const fileName = key.typeName === "mystery" ? "unknown" : key.typeName;
      return {
        pack: [`type/${typeArt}/${fileName}.png`],
        upstream: `types/generation-iii/${typeArt}/${typeId}.png`,
      };
    }
  }
}
