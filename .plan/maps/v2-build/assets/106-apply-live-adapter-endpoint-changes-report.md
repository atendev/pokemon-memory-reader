# Apply live `adapters` endpoint changes: decision report

Audit: APPROVE in round 1. Claude seat scored 8. Gemini and GPT: not run (out of quota). Four minor problems declined.

## What was built

- `Selector.refreshEndpoints()` in `server/src/adapter/selector.ts`. It remembers the endpoint each adapter was built with, compares it to the current one, and rebuilds each adapter whose host or port changed.
- `detach` now clears the live slot when it closes the live adapter, so the old session's resources go and the facade drops to disconnected.
- `server/src/main.ts` builds adapters from `config.applied()` instead of the startup settings, and calls `refreshEndpoints()` when the live `adapters` key changes.
- Four selector tests: mGBA rebuilt and live dropped, only RetroArch rebuilt, a pinned live RetroArch rebuilt and live again, and an unchanged endpoint touching nothing.

## Decisions

| Question | Options | Choice | By |
|---|---|---|---|
| Are these keys live or startup in the spec? | Build, or rule the ticket out | Live. Spec §9.4 lists adapter pin and endpoints as live, and `LIVE_KEYS` already holds `adapters`. Built. | Main thread |
| How does a changed endpoint reach an adapter? | A `setEndpoint` call on each adapter, or close and rebuild | Close and rebuild through the existing `detach` and `attach`. Adapters stay immutable and the old session's socket and timers go with `close()`. | Implementer |
| What happens to a live adapter that gets rebuilt? | Keep it live while the new one connects, or drop to disconnected | Drop. The facade shows disconnected and the epoch bumps. Auto mode goes live again when the new adapter answers, and a pinned selector sets the new pin live at once. | Implementer |
| Which adapters does a refresh touch? | All, or only changed ones | Only attached adapters whose host or port differs. A pinned selector has only the pin attached, and an unattached one reads the endpoint when it is built. | Implementer |
| What does `pending()` need? | A code change | None. It lists only startup keys, and `config.test.ts` already asserts `pending: []` for an `adapters` change. | Main thread |

## Audit

- Round 1: APPROVE 8, four minor problems, all declined.
  - Unhandled close rejection from `void detach(id)`: `applyPin` already uses the same call, and the adapters' `close()` does not reject.
  - `main.ts` wiring untested and assumes `applied()` is updated before `onLive` fires: `Config.change` sets `applied` before it calls listeners, and `main.ts` has no unit harness in the repo.
  - No new `pending()` test: `config.test.ts` already covers it.
  - Only host and port compared: `Endpoint` holds only those two fields.

## Known gap

The installed `mgba.lua` bridge file carries the mGBA endpoint from startup, and `generateBridges` runs only at startup. A changed mGBA endpoint therefore reaches the adapter, but the file on disk and the `/bridges/mgba.lua` copy keep the old one until a restart. Surfaced as a follow-up ticket.

## Checks

- `bun test`: 1583 pass, 1 fail. The failure is the Lua 5.3/5.4 core test, which needs a Lua binary this machine lacks. It is unrelated to this change.
- `bun run typecheck` and `biome ci .` pass.
