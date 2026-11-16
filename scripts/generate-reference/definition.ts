/** The pret repos the Gen 3 English reference data comes from, pinned (amendment 019 §1). */
export type Layout = "ruby" | "emerald" | "firered";

/** The art versions with a Gen 3 location table. Ruby and Sapphire share one, as do FireRed and LeafGreen (amendment 019 §4). */
export type LocationKey = "ruby-sapphire" | "emerald" | "firered-leafgreen";

export interface SourceDefinition {
  readonly repo: string;
  /** Which `artVersion` this repo's map-section names are keyed under. */
  readonly locationKey: LocationKey;
  readonly commit: string;
  readonly layout: Layout;
  /** Role to the file path inside the repo. Every path is read at `commit`. */
  readonly files: Readonly<Record<SourceRole, string>>;
}

export type SourceRole =
  | "speciesConstants"
  | "moveConstants"
  | "itemConstants"
  | "abilityConstants"
  | "pokemonConstants"
  | "growthConstants"
  | "pokedexConstants"
  | "speciesNames"
  | "moveNames"
  | "abilityNames"
  | "items"
  | "speciesInfo"
  | "moveInfo"
  | "dexOrder"
  | "charmap"
  | "mapSections";

export const sources: readonly SourceDefinition[] = [
  {
    repo: "pret/pokeemerald",
    locationKey: "emerald",
    commit: "731ad5bfd6e6f265508d0efcca0ba42f9dcf5881",
    layout: "emerald",
    files: {
      speciesConstants: "include/constants/species.h",
      moveConstants: "include/constants/moves.h",
      itemConstants: "include/constants/items.h",
      abilityConstants: "include/constants/abilities.h",
      pokemonConstants: "include/constants/pokemon.h",
      growthConstants: "include/constants/pokemon.h",
      pokedexConstants: "include/constants/pokedex.h",
      speciesNames: "src/data/text/species_names.h",
      moveNames: "src/data/text/move_names.h",
      abilityNames: "src/data/text/abilities.h",
      items: "src/data/items.h",
      speciesInfo: "src/data/pokemon/species_info.h",
      moveInfo: "src/data/battle_moves.h",
      dexOrder: "src/pokemon.c",
      charmap: "charmap.txt",
      mapSections: "src/data/region_map/region_map_sections.json",
    },
  },
  {
    repo: "pret/pokefirered",
    locationKey: "firered-leafgreen",
    commit: "ce6406d8c2eaf46d543c8a2606de0c3cb1951982",
    layout: "firered",
    files: {
      speciesConstants: "include/constants/species.h",
      moveConstants: "include/constants/moves.h",
      itemConstants: "include/constants/items.h",
      abilityConstants: "include/constants/abilities.h",
      pokemonConstants: "include/constants/pokemon.h",
      growthConstants: "include/constants/pokemon.h",
      pokedexConstants: "include/constants/pokedex.h",
      speciesNames: "src/data/text/species_names.h",
      moveNames: "src/data/text/move_names.h",
      abilityNames: "src/data/text/abilities.h",
      items: "src/data/items.json",
      speciesInfo: "src/data/pokemon/species_info.h",
      moveInfo: "src/data/battle_moves.h",
      dexOrder: "src/pokemon.c",
      charmap: "charmap.txt",
      mapSections: "src/data/region_map/region_map_sections.json",
    },
  },
  {
    repo: "pret/pokeruby",
    locationKey: "ruby-sapphire",
    commit: "5784633ce4ef7ade1a7f2d2d0c288e3d5e6cdd7f",
    layout: "ruby",
    files: {
      speciesConstants: "include/constants/species.h",
      moveConstants: "include/constants/moves.h",
      itemConstants: "include/constants/items.h",
      abilityConstants: "include/constants/abilities.h",
      pokemonConstants: "include/constants/pokemon.h",
      growthConstants: "include/pokemon.h",
      pokedexConstants: "include/constants/species.h",
      speciesNames: "src/data/text/species_names_en.h",
      moveNames: "src/data/text/move_names_en.h",
      abilityNames: "data/text/ability_names.inc",
      items: "src/data/items_en.h",
      speciesInfo: "src/data/pokemon/base_stats.h",
      moveInfo: "src/data/battle_moves.c",
      dexOrder: "src/pokemon_1.c",
      charmap: "charmap.txt",
      mapSections: "src/data/region_map/region_map_sections.json",
    },
  },
];
