import type { Type } from "@pokemon-memory-reader/api/schemas";
import type { ArtVersion } from "../profile/schema";

/**
 * Type name to PokeAPI type ID (spec §11.9). `mystery` is the ??? type, PokeAPI's `10001`.
 * Fairy has no Gen 3 type icon, so it stays unmapped and the route answers 404.
 */
export const POKEAPI_TYPE_IDS: Readonly<Record<Type, number | null>> = {
  normal: 1,
  fighting: 2,
  flying: 3,
  poison: 4,
  ground: 5,
  rock: 6,
  bug: 7,
  ghost: 8,
  steel: 9,
  mystery: 10001,
  fire: 10,
  water: 11,
  grass: 12,
  electric: 13,
  psychic: 14,
  ice: 15,
  dragon: 16,
  dark: 17,
  fairy: null,
};

/** The art versions that have a folder under `types/generation-iii/`. */
export const TYPE_ART_VERSIONS: readonly ArtVersion[] = [
  "ruby-sapphire",
  "emerald",
  "firered-leafgreen",
];

/**
 * Item ID to PokeAPI item slug, one table per art version (spec §11.9). The generator that fills
 * these from PokeAPI's `item_game_indices` is a separate ticket, so until it lands every item
 * request answers 404 and the viewer shows its name fallback.
 */
export const ITEM_SLUGS: Readonly<
  Record<ArtVersion, Readonly<Record<number, string>>>
> = {
  "red-blue": {},
  "red-green-japan": {},
  yellow: {},
  gold: {},
  silver: {},
  crystal: {},
  "ruby-sapphire": {},
  emerald: {},
  "firered-leafgreen": {},
};

/** Internal species IDs of vanilla Gen 3: Bulbasaur to Celebi, and Treecko to Chimecho (spec §11.9, hack profiles). */
export const isVanillaSpecies = (id: number): boolean =>
  (id >= 1 && id <= 251) || (id >= 277 && id <= 411);
