---
type: grilling
blocked_by: []
assets: []
---

# Importable package for overlay developers

## Question

Does v2 publish a package for overlay developers, and what does it contain?

Candidates are the API types, the Zod schemas, and an SSE client for [API v2 contract](./006-api-contract.md). Decide whether it ships, its name and registry, how it is versioned against `/api/v2`, and how it stays in sync with the app inside the Bun workspace from [Language and HTTP stack](./004-language-and-toolkit.md). The [License](./007-license.md) decision already covers its license.

## Answer

v2 publishes one MIT package, `@pokemon-memory-reader/api`, with v2.0. It is the single source of truth for the public API. The server, the viewer and outside overlays all import it.

- **Name and registry.** npm, scoped `@pokemon-memory-reader/api`. The owner claims the `pokemon-memory-reader` npm org before the first release candidate. If the org can't be claimed, the package becomes `pokemon-memory-reader-api`, and the name is updated in this ticket, the map, [Language and HTTP stack](./004-language-and-toolkit.md) and [Release pipeline](./017-release-pipeline.md). No JSR.
- **Workspace.** The package lives in `api/`, which replaces `shared/`. It holds only public API code. The config file and bridge reply schemas move into `server/`. A lint or test check fails if `api/` imports anything from `server/` or `viewer/`.
- **Contents.** Three subpath exports:
  - `/types` exports the inferred TypeScript types, with no runtime code.
  - `/schemas` exports Zod schemas for every resource, the error body and the SSE events, plus `TOPICS` (a const tuple of topic names, `status` included), a `ResourceMap` type and a `resourceSchemas` record keyed by topic.
  - `/client` exports `get` helpers per resource, `subscribe(topics, handlers, options)`, `PmrApiError`, `API_VERSION`, the base path and `DEFAULT_BASE_URL`.
- **Zod.** `zod` major 4 is an optional peerDependency. A user of types and the client never installs Zod.
- **Default base URL.** `DEFAULT_BASE_URL` is built from the default port and bind host that [Config file](./019-config-file.md) settles. That ticket must settle them before `2.0.0-rc.1`. Changing the default later breaks clients that rely on it, so it stays fixed within 2.x.
- **Client.** Options are `baseUrl` (defaults to `DEFAULT_BASE_URL`), injectable `fetch` and `EventSource`, and `validate` (off by default). With `validate: true`, the client lazy-loads `/schemas` and throws a clear error if Zod is missing. `subscribe` returns `{ close(), readonly connection }`, where `connection` is `"connecting" | "open" | "reconnecting" | "closed"`, and it reports changes through `onConnection`. The server's resend of every subscribed topic on connect covers reconnects. `subscribe` accepts `Topic | (string & {})`. Known topics go to typed handlers. A requested topic the package doesn't know goes to `onUnknown(topic, data)` as `unknown`, never validated, even with `validate: true`. The server sends only requested topics, so an older client never receives a topic it didn't ask for. The server ignores requested topics it doesn't know, and it returns `400` if `topics` is missing or names no known topic. On a `400` at connect, `subscribe` sets `connection` to `closed`, reports a `PmrApiError` of kind `http` through `onError`, and does not retry.
- **Errors.** There is one `PmrApiError` class with `kind`: `unavailable` (the 503 body's `code`, `message` and `status`), `http` (another status), `network` (the fetch failure as `cause`) and `invalid` (a failed opt-in validation). `get` helpers throw it, and `subscribe` passes it to `onError`. Fetching `status` never yields `unavailable`.
- **Forward compatibility.** Published schemas use loose objects that keep unknown keys. Error `code`, `dataFormat`, adapter `id` and topic names are open enums, typed as the known union plus `(string & {})` and validated as strings. Every other enum, such as `gender` and `status.state`, is closed and never gains a value within `/api/v2`. A server test fails if a closed enum changes. With validation on, an event that fails it is dropped and reported as `invalid`.
- **Versioning.** The package's semver major equals the API path version, so 2.x targets `/api/v2`. Minor means an additive API change, and patch means a fix to the package alone. Its version is independent of the app's. `/api/v3` ships as 3.0.0, and 2.x then gets security fixes only. Release candidates `2.0.0-rc.N` go out under the `next` dist-tag and are promoted to `latest` at v2.0.
- **Sync.** The server's snapshot and SSE routes are typed against `TOPICS`, `ResourceMap` and `resourceSchemas`, so a resource added on the server without the package fails typecheck. A server test validates real responses against the package schemas, and a snapshot test of `openapi.json` flags non-additive changes.
- **Viewer.** The viewer drops Hono's `hc` and uses `/client` for snapshots and SSE, passing its page origin as `baseUrl`. This dogfoods the public client and means the viewer imports no server code.
- **Build.** The build is ESM only with an ES2022 target. `tsc` emits JS and `.d.ts` to `dist/` with `.js` relative imports and no bundling, and `sideEffects` is `false`. The published `exports` map points only at `dist/`, and the source files match the subpaths (`src/types.ts`, `src/schemas.ts`, `src/client.ts`).
- **Workspace resolution.** The server and viewer depend on the package through `workspace:*`. A root `tsconfig.json` `paths` entry maps `@pokemon-memory-reader/api` and its three subpaths to `api/src/`, and `server/tsconfig.json` and `viewer/tsconfig.json` extend the root. Both `tsc` and Bun read `paths` from the tsconfig nearest the importing file, so without `extends` the alias does nothing. This alias is the only thing that lets tests, typecheck, the dev server and the executable read source with no build of `api/`. A throwaway workspace on Bun 1.4.2 confirmed it: `bun run`, `bun test` and `bun build --compile` resolved source with no `api/dist`, and `bun run` and `bun build --compile` both failed once the server tsconfig stopped extending the root. If the viewer moves to Vite, it needs the same alias. CI checks that the compiled executable works with `api/dist` absent, and it runs `publint` and `attw` against the packed tarball.
- **Package files.** The package has its own MIT `LICENSE` and a `files` whitelist of `dist`, `README.md` and `LICENSE`. The README carries an OBS browser-source example and a CDN `<script type="module">` example. The GPL server importing the MIT package is compatible.
- **Fixtures.** [Decoder test fixtures](./014-decoder-fixtures.md) deferred a fixtures package until an importable package existed. That condition is now met, and the answer is no fixtures package. Fixtures stay under `server/test/fixtures`, since no outside user needs them.

The package covers the main users (streamers and challenge runners), who write overlays in JS or TS for browser sources. The schemas already exist in the workspace, so the added cost is mostly packaging.

Excluded: no package (OpenAPI only), a types-only package, re-exporting `hc` (it needs the server's app type and pulls Hono into overlays), validating every payload by default, `zod` as a hard dependency, JSR, versioning in lockstep with the app, copying public schemas into a separate package at build time, generating the package from OpenAPI, a CJS build, shipping TypeScript source only, `bun build` for the package, export conditions for workspace source (Bun's runtime and bundler don't read `customConditions`, and the `src/` targets wouldn't ship in the tarball), the generic `development` condition, TypeScript project references, strict schemas, treating every enum as open, a required `baseUrl`, defaulting to `location.origin`, rejecting unknown topic names at the call site, and a published fixtures package.

Amends [Language and HTTP stack](./004-language-and-toolkit.md), [API v2 contract](./006-api-contract.md) and [Decoder test fixtures](./014-decoder-fixtures.md). Adds input to [Release pipeline](./017-release-pipeline.md) and [Config file](./019-config-file.md).
