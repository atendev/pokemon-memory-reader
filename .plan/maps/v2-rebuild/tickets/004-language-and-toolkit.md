---
type: grilling
blocked_by: [003]
assets: []
---

# Language and HTTP stack

## Question

What language is v2 written in, and what serves its API and viewer?

The form factor ticket removed the native GUI: the viewer is a web page served by the program, so no GUI toolkit is needed. Weigh fit with that form factor (a windowless local server that opens a browser), how easy each adapter is to write (UDP and TCP sockets), cross-platform builds for Windows and Linux, how well AI agents work in the language (types, test speed), and how simply the viewer's static files can ship inside the program.

## Answer

v2 is TypeScript on Bun, shipped as one self-contained executable per OS with the viewer embedded. The user installs no runtime.

- **Runtime.** Bun. `bun build --compile` cross-compiles Windows x64 and Linux x64 from one machine, plus macOS on a best-effort basis. Bun's built-in TCP and UDP sockets cover every adapter.
- **HTTP.** Hono on `Bun.serve`. The viewer calls the API through Hono's typed client (`hc`), and the zod-openapi add-on publishes an OpenAPI document for overlay developers who don't use TypeScript. Hono also runs on Node, which keeps a fallback off Bun open. The live-update transport (WebSocket or SSE) belongs to the API contract ticket; both are supported.
- **Schemas.** Zod defines API payloads, the config file, and bridge reply validation, and the shared types are inferred from it. Decoders produce typed objects straight from bytes and skip Zod.
- **Viewer.** It's a new build in this repo, starting from scratch, with nothing carried over from `pokemon-memory-viewer`. It uses React, bundled by Bun's HTML imports (hot reload in dev, embedded by `--compile` in release), and styles with Tailwind via `bun-plugin-tailwind`. Vite can replace Bun's bundler later without touching app code.
- **Repo layout.** Bun workspaces: `server/`, `viewer/`, `shared/`, and `bridges/` for the Lua scripts.
- **Tooling.** `bun test`, `tsc --noEmit` in strict mode, and Biome for lint and format across the repo.

A single language across the program and the viewer outweighed binary size, which is about 60–100 MB, and Bun's younger Windows support. Bridges stay in Lua because mGBA and BizHawk only run Lua.

Excluded: Go (it would need a second language for the viewer and hand-synced types), Rust (agents iterate on it slowly), Deno (UDP sits behind an unstable flag), Elysia (it locks the program to Bun), Vite as the default bundler, and requiring users to install a runtime.
