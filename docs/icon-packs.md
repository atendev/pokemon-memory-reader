# Icon packs

The viewer loads every image from the program's `/icons/...` route. The program looks for each file in your icon pack first, then in its download cache, then upstream when `mode` is `"online"`. Put your own art in the icon pack to replace or add to what the program downloads. No icons ship with the program.

## Where the pack lives

`<data folder>/icons/`. The program never watches this folder. Edit a file and reload the viewer page to see it, because the browser revalidates icons on each load.

A file is used only if it is a PNG of 512 KB or smaller. A file that fails the check is logged once per run and treated as missing.

## Layout

```
icons/
  pokemon/{artVersion}/{dex}.png
  pokemon/{artVersion}/shiny/{dex}.png
  icon/{dex}.png
  item/{itemSlug}.png
  type/{typeArtVersion}/{typeName}.png
  hack/{profileId}/pokemon/{speciesId}.png
  hack/{profileId}/pokemon/shiny/{speciesId}.png
  hack/{profileId}/icon/{speciesId}.png
  hack/{profileId}/item/{itemId}.png
```

| Path                                   | Use                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| `pokemon/{artVersion}/{dex}.png`       | Front sprite for party cards and battlers. `dex` is the National Dex number.            |
| `pokemon/{artVersion}/shiny/{dex}.png` | Shiny front sprite. Gen 1 never asks for one.                                           |
| `icon/{dex}.png`                       | Gen 3 menu icon for the Boxes grid and opponent party tiles, for all three generations. |
| `item/{itemSlug}.png`                  | Item or ball art, named by its PokeAPI slug.                                            |
| `type/{typeArtVersion}/{typeName}.png` | Type icon.                                                                              |
| `hack/{profileId}/...`                 | Art for a hack profile, named by the hack's own IDs.                                    |

`artVersion` is one of `red-blue`, `red-green-japan`, `yellow`, `gold`, `silver`, `crystal`, `ruby-sapphire`, `emerald` and `firered-leafgreen`.

`typeArtVersion` is the folder the type icon resolved to: `ruby-sapphire`, `emerald` or `firered-leafgreen`. Gen 1 and Gen 2 games use `firered-leafgreen`.

`typeName` is the type in lowercase. The ??? type is written `unknown` in pack paths, because `?` is not a legal Windows filename character. Its route key is `mystery`. Fairy has no Gen 3 icon.

## Lookup order

- **Official profile:** the normal pack path, then the cache, then upstream.
- **Hack profile:** `hack/{profileId}/...` first. For vanilla Gen 3 species IDs (1-251 and 277-411) and items the program maps, it then goes on to the normal pack path, the cache and upstream. Any other ID stops after the hack folder and never reaches upstream.

A species or item ID the program has no table entry for answers `404`, and the pack is not consulted for it, except through a hack profile's own `hack/{profileId}/` folder. Gen 1 species IDs follow the cartridge's own order, so they go through a dex table. Items resolve only when PokeAPI has art for them.

## Cache and network

Downloaded files live in `<data folder>/icon-cache/<sourceId>/`. They never expire. At startup the program deletes every cache folder except the one for the source in use. Set `icons.baseUrl` to point at a mirror of the PokeAPI/sprites tree.

An upstream `404`, or any other `4xx` except `429`, is remembered for the run. A `429`, a `5xx` or a network error pauses that source for 60 seconds.

## Maintaining the ID tables

`server/src/icons/data/icon-maps.json` holds the Gen 1 species-to-dex table, the Gen 2 one and the item ID to PokeAPI slug table for each art version. It is generated and checked in. `bun run generate:icon-maps` rebuilds it from PokeAPI's CSV data at the commit pinned in `scripts/generate-icon-maps/main.ts`, and a rerun gives the same file. Items with no art at the pinned sprites SHA are left out.

`bun run check-icon-map` sends a HEAD request for every upstream path the tables can reach and lists the ones that don't resolve. It uses the network and runs by hand, never in CI. Run it whenever the sprites SHA in `server/src/icons/source.ts` changes. It takes a few minutes. Pass a mirror URL as its argument to check a mirror.
