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

This project is not affiliated with Nintendo, Game Freak or The Pokémon Company.
