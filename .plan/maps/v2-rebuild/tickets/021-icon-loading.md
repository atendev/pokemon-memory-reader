---
type: grilling
blocked_by: [016]
assets: []
claimed_by: wayfinder-master v2-rebuild-master-1794532844
claimed_at: 2026-11-13T01:20:44Z
---

# Icon loading and fallbacks

## Question

Where does the viewer load icons from, and what does it show when no icon exists?

[Icon and sprite source](./016-icon-source.md) recommends PokeAPI/sprites as the default. Decide the default base URL (raw GitHub, jsDelivr or a user-run mirror), whether the app caches icons on disk so each one is fetched once, how users point the viewer at their own icon pack, and the fallback for Gen 1-2 box icons and ROM-hack species that no source covers.

Input from [Config file](./019-config-file.md): icon settings live under the `icons` key of `config.json`, apply live, and are the same for the OBS source and the normal browser. This ticket sets the shape of that key and its defaults. Any icon cache goes in the data folder.

## Answer

The program serves every icon from its own `/icons` route. It looks for each file in the user's icon pack first, then in a disk cache, then upstream at a pinned jsDelivr copy of PokeAPI/sprites, and it never bundles art. Pokémon art on cards matches the running game's version. Anything without art gets a type-coloured tile or its name.

- **Fetch path.** The viewer only loads images from `/icons/...` on the program. For each file the program checks the icon pack, then `<data folder>/icon-cache/`, then upstream when `mode` is `"online"`. The OBS source and the normal browser share one fetch, and icons keep working offline once fetched.
- **Upstream.** The default source is `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@<sha>`, pinned to a commit SHA held as a constant in `server/`. The first pin is `1b3b7c0a538dd2226ae08d0d2f8955125075bbd4` (2026-11-03). If `check-icon-map` reports misses at that SHA, the implementer fixes the mapping tables or pins a newer SHA where the check passes. A pinned SHA means upstream renames can't break a shipped build. `@master` on any host was rejected because a rename upstream would break shipped builds without warning. raw.githubusercontent.com was rejected even at a pinned SHA because GitHub doesn't offer it as a CDN, caches it for 5 minutes and throttles heavy use.
- **Art per screen.** Party cards and both battlers on the Battle screen, the player's and the opponent's, use the static front sprite from the running game's art version folder, `pokemon/versions/<generation>/<artVersion>/`. Gen 1-2 use that folder's `transparent/` subfolder where it has one. `red-green-japan` has none, so it uses the base folder. Shiny Pokémon use `shiny/` in Gen 3 and `transparent/shiny/` in Gen 2. Gen 1 has no shiny flag or shiny art, so the viewer never requests a shiny sprite for a Gen 1 profile, and such a request returns `404`. Nothing is animated, and no back sprites are used. The Boxes grid and the opponent party tiles use the Gen 3 menu icons, `pokemon/versions/generation-iii/icons/<dex>.png`, for all three generations. These icons have no shiny variant, so shiny Pokémon show the normal icon there.
- **Gen 1-2 box icons.** No source has Gen 1-2 box icons. The Gen 3 menu icons are the fallback, and since they cover dex 1-386 they include every Gen 1-2 species. Beyond that, a Gen 1-2 box slot gets the normal fallback tile only when a fetch fails.
- **Type and item art.** Gen 3 type icons come from the running version's folder under `types/generation-iii/`. Gen 1-2 had no type icons, so they use `types/generation-iii/firered-leafgreen/`. The ??? type maps to PokeAPI type `10001`. Items and balls use `items/<slug>.png` for every generation.
- **Art version.** Each game profile gains a required `artVersion`, one of `red-blue`, `red-green-japan`, `yellow`, `gold`, `silver`, `crystal`, `ruby-sapphire`, `emerald` or `firered-leafgreen`. Japanese Red and Green use `red-green-japan`. A hack profile sets its base game's value.
- **Route.** The viewer builds URLs from the profile ID in `status` and IDs the API already sends, so the public API doesn't change:
  - `GET /icons/{profileId}/pokemon/{speciesId}` and `GET /icons/{profileId}/pokemon/{speciesId}/shiny` for card sprites
  - `GET /icons/{profileId}/icon/{speciesId}` for menu icons
  - `GET /icons/{profileId}/item/{itemId}` for items and balls
  - `GET /icons/{profileId}/type/{typeName}` for type icons

  The program resolves the art version, generation and profile kind from the profile ID. A URL never changes meaning when the game changes. With no identified game the viewer makes no icon requests.
- **Key grammar.** `profileId` must equal the ID of a loaded game profile exactly, and it must also match `[A-Za-z0-9._-]+` and not be `.` or `..`, because it becomes a folder name in the pack. `speciesId` and `itemId` are the game-internal IDs from the API's references, written as decimal integers 0-65535 with no leading zeros. `typeName` is one of the API's type enum values, URL-encoded by the viewer, and that includes the ??? type. `shiny` is a literal last path segment and is valid only on `pokemon` routes. Any other path, an unknown profile ID, or a value outside these rules returns `404`. A unit test covers the grammar.
- **ID mapping.** The program maps keys to upstream paths with tables generated at dev time and checked into `server/`. Internal species ID to dex comes from each data format's reference data. Item ID to PokeAPI item slug covers Gen 1, Gen 2 and Gen 3, with one table per `artVersion`. The generator uses PokeAPI's item data, such as its `item_game_indices` table, and falls back to matching English names at dev time where that data lacks a generation's index. Type name maps to PokeAPI type ID. An ID a table doesn't map returns `404`, and the viewer shows the fallback. A unit test checks the tables' shape. The viewer never slugifies names, an approach that fails for null and Japanese names.
- **Hack species and items.** On a profile with `kind: "hack"`, a species can get upstream art only when its internal ID is a vanilla Gen 3 species ID (1-251 or 277-411). Its dex then comes from the vanilla table, not the hack's. An item can get upstream art only when its ID is mapped in the item table for the hack's `artVersion`. That table is checked into `server/`, so no official profile needs to be loaded. IDs outside those sets are looked up only in the pack's `hack/{profileId}/` folder and never upstream, so a new form with a vanilla dex number can't show the wrong sprite.
- **Icon pack.** A user's own files live in `<data folder>/icons/`, a fixed path moved only by the data-folder override, like `profiles/`. The program creates the empty folder at startup. The layout follows the logical keys:

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

  `typeArtVersion` is the folder the type icon resolved to, so `firered-leafgreen` for Gen 1-2. In pack paths the ??? type is written `unknown`, PokeAPI's name for type `10001`, because `?` is not a legal Windows filename character. A doc in the repo describes the layout, and Settings links to it. The program never watches the folder. Edits show on the next viewer reload, because of the HTTP caching rule below.
- **Lookup order.** A valid pack file wins over the cache and upstream. For a hack profile, the program checks `hack/{profileId}/...` first. For a hack species or item in the vanilla set it then checks the normal pack path, then the cache, then upstream. Outside the vanilla set it stops after the hack folder. For an official profile it checks the normal pack path, then the cache, then upstream.
- **Mirror.** `icons.baseUrl` can point at any mirror of the PokeAPI/sprites tree, meaning the folder that contains `sprites/`, and replaces the jsDelivr default. The program trusts a mirror to match the pinned layout and doesn't check it.
- **Disk cache.** Cached files live in `<data folder>/icon-cache/<sourceId>/` under their upstream path. `sourceId` is `pokeapi-<sha>` for the default and `mirror-<first 12 hex of sha256(baseUrl)>` for a mirror. The source in use is the one the current `baseUrl` resolves to, whatever the `mode`. Files never expire and have no size cap, since a pinned source never changes and the usable set is a few MB. At startup the program deletes every cache folder except the source in use. A live `baseUrl` change leaves the old folder until the next startup. Writes go to a temp file and are renamed into place. Upstream `404`s are remembered in memory for the run only.
- **Route rules.** Upstream fetches time out after 5 s, at most 4 run at once, and parallel requests for one key share one fetch. A network error, as opposed to a `404`, backs off that source for 60 s. The program serves only PNGs that pass a magic-byte check and are 512 KB or smaller. A pack file that fails the check logs one warning per run and is treated as absent, so lookup moves to the next source. A cached file that fails is deleted and fetched again. An upstream response that fails is not cached, returns `404` and is remembered like a `404` for the run. Responses carry `Content-Type: image/png`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-cache` and an ETag of the content hash. Browsers revalidate on each load and get a `304` from the program, so pack edits, mode changes and cache clears show on the next reload with no version tokens. Any non-2xx makes the viewer show the fallback for that image until the key changes or the page reloads.
- **Fallbacks.** A Pokémon with no image shows a rounded tile at the sprite's size, tinted with its primary type colour. The tile shows the first letter of the name, or `#<id>` when the name is null. An item or ball with no image shows its name as text, or `#<id>` when the name is null. A type with no image shows a badge in the type's colour with the type name. These match [Viewer design](./008-viewer-design.md), and the same fallbacks show when `mode` is `"off"`.
- **Config.** The `icons` key in `config.json`, with its default:

  ```json
  "icons": { "mode": "online", "baseUrl": null }
  ```

  `mode` is `"online"` (pack, cache, then upstream), `"local"` (pack only, with no network requests at all) or `"off"` (no images, so the viewer makes no requests and the route returns `404`). `baseUrl` is `null`, meaning the pinned default, or an `http` or `https` URL. A trailing slash is dropped. Invalid values fall back to their defaults with one warning, per [Config file](./019-config-file.md). Both keys apply live.
- **Scope.** `/icons` sits outside `/api/v2`, carries no stability promise and is not in the API package. It answers any client that can reach the viewer, LAN included, since it only reads. The README says overlays may use it at their own risk. A tolerated-use art source stays out of the versioned API.
- **Settings screen.** The icon section has a mode select (Online, Local pack only, Off), a mirror URL field where empty means default, the pack folder path with a copy button and a link to the layout doc, and the cache size with a "Clear icon cache" button. It also carries a note that the art is © The Pokémon Company, loaded from PokeAPI/sprites and not bundled. `GET /settings` adds the pack path and the cache path and size. The clear button calls `POST /settings/icon-cache/clear`, which deletes every source folder under `icon-cache/` and has the same loopback, `Content-Type`, `Host` and `Origin` guards as `PUT /settings`.
- **Coverage check.** A dev-time `check-icon-map` script sends a HEAD request for every mapped upstream path at the pinned SHA and lists misses. `RELEASING.md` runs it whenever the SHA changes and blocks the release until it passes. CI stays offline.

Excluded: the browser hotlinking upstream; a proxy without a disk cache; raw GitHub and any `@master` URL; modern sprites or menu icons on every screen; back sprites and animated sprites; a plain grey or empty fallback; icon keys or slugs in the public API; slugifying names in the viewer; a single `{dex}` URL template as the only custom source; trusting any non-null dex on hacks; upstream art for hack-only species and items; a size-capped LRU and TTL expiry; `{ enabled }` and per-category toggles; lenient pass-through; loopback-only `/icons`; long `Cache-Control` and revision query params; `/icons` as a public API contract; and a networked CI coverage job.

Amends [Game profile source and format](./005-game-profile-source.md): profiles gain a required `artVersion`. Amends [Viewer design](./008-viewer-design.md): the Pokémon fallback is a type-coloured tile, and the Settings icon section above replaces the custom `{dex}` sprite URL. Amends [Config file](./019-config-file.md): it sets the `icons` shape, adds `icons/` and `icon-cache/` to the data folder, adds the pack path and cache fields to `GET /settings`, and adds the guarded `POST /settings/icon-cache/clear`. Amends [Release pipeline](./017-release-pipeline.md): `RELEASING.md` runs `check-icon-map` when the pinned SHA changes and blocks the release until it passes.
