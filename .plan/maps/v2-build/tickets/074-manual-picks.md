---
type: task
blocked_by: [072, 073]
claimed_by: wfm-v2-build-master-1795260524
claimed_at: 2026-11-21T12:31:46Z
---

# Manual ROM picks

## What to build

Spec §9.6 with [the 014 amendment](../assets/014-rom-keying-and-reidentification.md) and [the 021 amendment](../assets/021-viewer-control-routes.md). Picks are stored in the data folder and keyed by any emulator hash (SHA-1, else CRC32), else a header key tagged with the platform, plus RetroArch's content name when it has no hash. The opt-in `base:<profileId>` pick covers randomizer seeds. The server sets the key. The internal `/manual-picks` route is pick and forget, behind the shared write guard from 021.

## Acceptance criteria

- Tests cover each key kind, a `base:<profileId>` pick, forgetting a pick and a pick surviving a restart.
- The route-table test from 021 covers `/manual-picks`, and a write without the guard is refused.
- A picked game identifies with the pick shown in `status`.

## Handoff

Branch `t3/manual-rom-picks`, wip commit `85c3920`. Tag `wfm-v2-build-074-1795260524`. Audit round 0 (council not run yet).

**Done (typechecks, biome clean):**
- `server/src/identify/pick-keys.ts`: `romKeys(game, header)`, `baseKey`, key escaping.
- `server/src/identify/pick-store.ts`: `openPickStore(path, log)` (Zod, re-read/merge, atomic rename, `.bad` quarantine), `noPickStore`.
- `server/src/identify/identify.ts`: `identification(game, registry, picks?)` now does base-pick eligibility reads, pick lookup (session, ROM key, `base:<P>`), `match: "manual"`, `pick`, `eligible`.
- `server/src/loop/read-loop.ts`: `picks` dep, `Session.sessionPick`, `pick()`, `forget()`, atomic `reidentify`.
- `server/src/app/app.ts` + `route-table.ts` + `server.ts` + `main.ts`: `POST /manual-picks`, `POST /manual-picks/forget` (write guard), wired to `<data folder>/manual-picks.json`.
- `internal/src/manual-picks-route.ts`: request/response schemas.

**Left, in order:**
1. `bun test`: 2 route-table tests in `server/test/api/internal-routes.test.ts` fail because `everything()` needs a `picks` dep (pass a stub or real loop). Add route-table rows to the class test, and a write-without-guard refusal test for `/manual-picks`.
2. New tests: `server/test/identify/pick-keys.test.ts` (each key kind: sha1, crc32, both, gba/gb header, RetroArch header+name, name key, none, escaping), `pick-store.test.ts` (save, forget, restart survival, `.bad` quarantine, merge with another writer), identify tests (manual pick, `base:` pick, ineligible base, unloaded profile skipped, several base candidates stay unidentified), loop/`/status` test (pick shows `match: "manual"`, forget lands back on `unidentified`, `pick_not_allowed`, `unknown_profile`, `base_pick_not_allowed`, `no_rom`).
3. Full `bun test` (known failure: Lua 5.5 check) and `bun run lint`.
4. Council audit (Claude seat only), decision report to `.plan/maps/v2-build/assets/074-manual-picks-report.md` (unslop), timing close, resolve ticket, delete this section, push, return DONE.

**Decisions to report:** GET `/manual-picks` (candidates list) is not built, since the ticket says "pick and forget": surface a ticket for it (needs per-candidate signature reads). `expansion_rom` is not wired: no RHHEXP scan exists yet (surface or note for that ticket). Session-only pick when no key or write failed. A changed pick forgets the entry that applied first. Base eligibility needs a second signature read when a hash is present.

**Files to read first:** `server/src/identify/identify.ts` (bottom), `server/src/loop/read-loop.ts` (`pick`, `forget`, `reidentify`), `server/test/api/internal-routes.test.ts`.
