# `/icons` route and cache: decision report

Ticket: `/icons` route and cache. Spec: §11.9. Branch: `t3/icons-route-cache-2`, continued from `t3/icons-route-cache` at `812df2c`. Audit: Claude seat only. The Gemini and GPT seats are `n/a` (out of quota), so one Claude APPROVE passes the gate. Pack layout doc: [docs/icon-packs.md](../../../../docs/icon-packs.md).

## Audit verdict

APPROVE at round 1. Claude seat 8, Gemini n/a, GPT n/a. Three minor problems: one fixed, two declined.

## Decisions

1. **Route key for the ??? type.** Question: how the route and pack name the ??? type. Options: `?` in the URL, or a word. Choice: the API's `mystery` enum value is the route key, and `unknown` is the pack file name, because `?` is not a legal Windows filename character (spec §11.9). Made by: implementer.

2. **Fairy.** Question: what Fairy does when Gen 3 has no Fairy icon. Choice: Fairy stays unmapped, so `/icons/.../type/fairy` answers `404` and the viewer shows its fallback. Made by: implementer.

3. **Upstream failure classes.** Question: how to treat non-2xx upstream answers. The spec only names `404` (remembered) and network errors (60 s back-off). Options: treat every non-2xx as a remembered miss, or split by class. Choice: any `4xx` except `429` is a remembered miss for the run, since jsDelivr answers `403` for some missing files. A `429`, any `5xx` and a network error back that source off for 60 s. Made by: implementer.

4. **Gen 1 and Gen 2 species.** Choice: no dex table exists until their reference data ships, so these species answer `404` and the pack is not consulted for them. Hack profiles still find their own `hack/{profileId}/` files. Follow-up ticket fills the tables. Made by: implementer.

5. **Items.** Choice: `ITEM_SLUGS` ships empty for every art version, so every official-profile item request answers `404`. The generator that fills it from PokeAPI `item_game_indices` is a separate ticket, because it needs a network fetch and a `check-icon-map` script. Hack item folders work today. Made by: implementer.

6. **Lookup plan as a pure function.** Choice: `plan.ts` turns a key and a profile into the pack paths to try and the upstream path, with the ID tables injected, so the hack-first order and the vanilla-ID rule are tested without the filesystem or network. Made by: implementer.

7. **Cache and fetch rules.** Choice, from the spec: pack, then cache, then upstream only in `online` mode. Writes use a temp file and a rename. Fetches time out at 5 s, run at most 4 at once, and share one in-flight fetch per key. A PNG must pass the magic-byte check and be 512 KB or smaller. A bad pack file logs one warning per run. A bad cached file is deleted and fetched again. Startup prunes every cache folder except the source in use. Made by: implementer.

8. **Wiring.** Choice: `GET /icons/*` is a static entry in the route table, so the route-table test covers it. The settings are read live per request, and `main.ts` prunes at startup. Made by: implementer.

## Minor problems

- Fixed: `docs/icon-packs.md` said Gen 1-2 species answer `404` "unless the pack has the file". The code returns before any pack path is built when the dex is missing. The doc now says the pack is not consulted.
- Declined: the code backs off on `429` and `5xx` while the spec line says a failing upstream response is "remembered for the run". The spec's 60 s back-off covers network errors only, and treating a rate limit or server error as a permanent miss would hide icons that exist. This is recorded as decision 3.
- Declined: `clearCache` has no production caller, so the "cache clears show on the next reload" path is not wired. The ticket does not require a clear action, and no settings route offers one yet.

## Evidence

- Whole `bun test`: 1208 pass, 6 skip, 1 fail. The failure is the known Lua version check in `server/test/bridge/core.test.ts` (host has Lua 5.5).
- `bunx biome check .` and `bun run typecheck` are clean.
- Tests cover a cache hit and miss, a missing icon, bad paths and the key grammar, and the pack lookup order (`server/test/icons/`, plus icon cases in `server/test/api/internal-routes.test.ts`).
- No PNG or ROM bytes are committed. Test images are generated in memory.
