# Icon source research (ticket 016)

Checked 2026-11-11 against repo files and live endpoints.

## Findings per source

### PokeAPI/sprites ([repo](https://github.com/PokeAPI/sprites))
- **License.** `LICENCE.txt` opens with "All image contents within are Copyright The Pokémon Company." followed by CC0 1.0 for the repository ([LICENCE.txt](https://github.com/PokeAPI/sprites/blob/master/LICENCE.txt)). GitHub reports the license as NOASSERTION. CC0 cannot grant rights in the images, so in practice the art is Nintendo/TPC-owned and tolerated, not licensed.
- **Stance.** The README says "To save load on PokéAPI, we host all the sprite images here" and "If you want to use all the sprites in your application, you can just download the entire contents directly" ([README](https://github.com/PokeAPI/sprites#readme)). It has no hotlinking terms and no rate limit.
- **PokeAPI fair use** ([docs](https://pokeapi.co/docs/v2)): no rate limit since the Nov 2018 static move, but "locally cache resources whenever you request them", and abusers get IP-banned. That policy covers the API, not the sprite repo.
- **Delivery.** `raw.githubusercontent.com` returns `access-control-allow-origin: *` and `cache-control: max-age=300`. `cdn.jsdelivr.net/gh/PokeAPI/sprites@master/...` returns 200. GitHub raw is not meant as a production CDN, so a runtime fetch should cache to disk.
- **Coverage.**
  - Items: `sprites/items/` has about 3,400 files, including balls (`poke-ball.png`, `great-ball.png`, `beast-ball.png`, and others). Names are slugs matching PokeAPI item names.
  - Types: `sprites/types/generation-iii/{ruby-sapphire,firered-leafgreen,emerald,colosseum,xd}` up to `generation-ix`, indexed by PokeAPI type ID.
  - Gen 3 menu icons: `sprites/pokemon/versions/generation-iii/icons/1..386.png` plus `10001-10003`. Other gen 3 and older folders are full-size front/back sprites (gen-i, gen-ii, gen-iii), not box icons.
  - Gen 1-2 box icons: none. Gen 7 icons exist in other folders (not verified in this pass).
  - ROM-hack species: none. Only canonical PokeAPI IDs plus its form IDs. Radical Red and other CFRU forms are not covered.
- **Mirroring.** The repo is a plain file tree and the README invites downloading all of it. It is large (about 62,000 files in the tree, truncated by the API), so a user-side mirror needs a subset.

### msikma/pokesprite ([repo](https://github.com/msikma/pokesprite))
- **License.** "The sprite images are © Nintendo/Creatures Inc./GAME FREAK Inc." Code and everything else is MIT ([README](https://github.com/msikma/pokesprite#license)). GitHub detects MIT.
- **Hotlinking.** Not addressed. It ships as an npm package (`pokesprite-images`) and sprite database JSON (`data/pokemon.json`, `data/item-map.json`) for local use.
- **Coverage.** Items: gen 3-8 inventory items (`items/`, `items-outline/`) with 32x32 icons, and `icons/ball/*` (103 files in `icons/` ball dir). Types: `misc/types/gen8`. Pokemon: gen 8 style (`pokemon-gen8`) and gen 7 (`pokemon-gen7x`) 68x56 box sprites, and 40x30 gen 6-7 icons in `icons/pokemon`. The README says gen 1-2 and gen 3-4 collections are not included. No gen 3 era box icons and no ROM-hack species.
- **Mirroring.** Easy: a small package with JSON mapping tables, installable by users.

### Pokemon Showdown ([pokemonshowdown.com/credits](https://pokemonshowdown.com/credits), [client repo](https://github.com/smogon/pokemon-showdown-client))
- **License.** The client code is AGPL-3.0. The README says the repo excludes `/sprites/` and `/audio/` "for size reasons", and gives no license or usage terms for them. The credits page has no asset policy. The Rules page was not read.
- **Hotlinking.** `play.pokemonshowdown.com/sprites/...` serves 200 behind Cloudflare, but no stated policy permits use outside the site. A sprite sheet `pokemonicons-sheet.png` exists. Relying on it is unlicensed.
- **Coverage.** Pokemon icon sheet through current gens, items sheet, and `gen5` sprites. No ROM-hack species. Type and ball icons are CSS/sheet-based and less file-friendly. Not independently verified in detail.

### Bulbagarden Archives / Bulbapedia
- Archives host Nintendo images under fair-use claims, not a free license. The copyright pages returned HTTP 403 to the fetcher, so their stated policy was not read. Treat as unverified. The msikma README points to the Archives' "Game sprites" category as a manual source.
- No sanctioned hotlinking API. Not suitable as a runtime default.

### Serebii ([serebii.net](https://www.serebii.net/))
- Footer: "All Content is © Copyright of Serebii.net 1999-2026" and Pokémon names are Nintendo trademarks. No reuse or hotlinking policy was found (FAQ URL returned 404). Hotlinking is likely unwelcome. Not suitable.

## Comparison

| Source | Image license | Hotlink policy | Items | Balls | Type icons | Gen 3 box/menu icons | Gen 1-2 icons | ROM-hack species | Mirror-friendly |
|---|---|---|---|---|---|---|---|---|---|
| PokeAPI/sprites | CC0 on repo; images "Copyright The Pokémon Company" | none stated; invites bulk download | yes (about 3,400) | yes, as items | yes, per game gen III+ | yes, 1-386 (+3 forms) | no | no | yes, plain files, large |
| msikma/pokesprite | MIT code; images (c) Nintendo | none stated | yes, gen 3-8 | yes | yes, gen 8 only | no (gen 6-8 styles) | no | no | yes, npm + JSON |
| Showdown | no asset terms | none stated | sheet | sheet | CSS | newer style icons | newer style | no | not an offered download |
| Bulbagarden Archives | fair-use hosting | not read | per file | per file | per file | per file | per file | no | no |
| Serebii | (c) Serebii, TM Nintendo | none found | yes | yes | yes | yes | yes | no | no |

## Takeaways
- No source licenses Nintendo art; every option is tolerated use of third-party-owned images. This fits the License ticket's decision to bundle nothing.
- PokeAPI/sprites is the only one with the exact layout the viewer needs: items, balls and gen-appropriate type icons by PokeAPI ID, plus gen 3 icons 1-386. It lacks gen 1-2 icons and ROM-hack forms.
- msikma/pokesprite is the best offline-friendly fallback for items, but lacks gen 3 era icons.
- Nothing covers ROM-hack species. The viewer needs name fallbacks or user-supplied icon packs for those.
