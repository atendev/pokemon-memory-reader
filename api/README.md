# @pokemon-memory-reader/api

Types, Zod schemas and a small client for the Pokemon Memory Reader API v2. The package is ESM only and MIT licensed. Semver major equals the API path version, so 2.x targets `/api/v2`.

`zod` 4 is an optional peer dependency. Install it only to use `/schemas`. The `/types` and `/client` declarations never import `zod`, so a TypeScript project without it typechecks with `skipLibCheck` off.

Three subpaths:

- `/types`: hand-written TypeScript types for every resource, checked equal to the `/schemas` inferred types. No runtime code.
- `/schemas`: Zod schemas for every resource and the error body, plus `TOPICS`, `ResourceMap` and `resourceSchemas`.
- `/client`: `get`, `getStatus` and `getParty`, `PmrApiError`, `API_VERSION` and the default host, port and base URL.

## OBS browser source

Serve a page like this next to your overlay files and add it to OBS as a browser source. The program listens on `http://127.0.0.1:7425` by default.

```html
<div id="party"></div>
<script type="module">
  import { getParty } from "https://cdn.jsdelivr.net/npm/@pokemon-memory-reader/api@2/dist/client.js";

  async function refresh() {
    try {
      const { pokemon } = await getParty();
      document.getElementById("party").textContent = pokemon
        .map((p) => `${p.nickname ?? p.species.name} L${p.level}`)
        .join(" | ");
    } catch (error) {
      document.getElementById("party").textContent = error.message;
    }
  }

  refresh();
  setInterval(refresh, 1000);
</script>
```

## In a bundled project

```ts
import { getStatus, PmrApiError } from "@pokemon-memory-reader/api/client";

try {
  const status = await getStatus({ baseUrl: "http://127.0.0.1:7425" });
  console.log(status.state);
} catch (error) {
  if (error instanceof PmrApiError && error.kind === "unavailable") {
    console.log(error.code);
  }
}
```

Branch on `kind` and `code`, never on `message`.
