# Pokemon Memory Reader

Version 2 is a rewrite in progress and doesn't run yet. It will be one executable that reads Pokémon game memory from mGBA, BizHawk and RetroArch, serves it over a local HTTP API, and shows it in a built-in viewer.

## Looking for v1?

The v1 Lua script is frozen at the [`v1-lua`](https://github.com/atendev/pokemon-memory-reader/tree/v1-lua) tag, and its downloads stay on the [releases page](https://github.com/atendev/pokemon-memory-reader/releases). v1 was released under the GPL-3.0 text in its `LICENSE` file.

## Development

v2 is a Bun workspace with `server/`, `viewer/`, `api/`, `internal/` and `bridges/`. Use the Bun version pinned in `package.json`.

```sh
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun test
```

## License

v2 is licensed under GPL-3.0-or-later. See `LICENSE` and `NOTICE`. The `@pokemon-memory-reader/api` package in `api/` is MIT licensed. See `api/LICENSE`.

The compiled program statically links JavaScriptCore (WebKit) and tinycc, which are under the GNU LGPL. Their source is attached to every release and comes from [`oven-sh/WebKit`](https://github.com/oven-sh/WebKit/tree/2e2aa2290fac856d6f451ceacb58f7f5b44dd057) and [`oven-sh/tinycc`](https://github.com/oven-sh/tinycc/tree/05f0fafaa3be31e31d7b4b5c17dc60f62c991171), and the steps to rebuild with your own changes are in [`docs/lgpl-relinking.md`](docs/lgpl-relinking.md).

This project is not affiliated with Nintendo, Game Freak or The Pokémon Company.
