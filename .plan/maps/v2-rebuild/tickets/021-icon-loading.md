---
type: grilling
blocked_by: [016]
assets: []
---

# Icon loading and fallbacks

## Question

Where does the viewer load icons from, and what does it show when no icon exists?

[Icon and sprite source](./016-icon-source.md) recommends PokeAPI/sprites as the default. Decide the default base URL (raw GitHub, jsDelivr or a user-run mirror), whether the app caches icons on disk so each one is fetched once, how users point the viewer at their own icon pack, and the fallback for Gen 1-2 box icons and ROM-hack species that no source covers.

Input from [Config file](./019-config-file.md): icon settings live under the `icons` key of `config.json`, apply live, and are the same for the OBS source and the normal browser. This ticket sets the shape of that key and its defaults. Any icon cache goes in the data folder.
