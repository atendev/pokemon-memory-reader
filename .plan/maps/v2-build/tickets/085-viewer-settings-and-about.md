---
type: task
blocked_by: [075, 076, 081]
claimed_by: wfm-v2-build-master-1795265782
claimed_at: 2026-11-21T13:05:00Z
---

# Viewer Settings and About screens

## What to build

Spec §11.7. Settings shows endpoints, `pollHz` and `updateCheck` from `/settings`, the adapter picker when [the adapter selector](./080-adapter-selector-and-adapters-route.md) exists, and the manual pick control. About shows the version, the LGPL lines and a link to the notices file. The update banner reads `/update`. `paths` is shown only when it is not null.

## Acceptance criteria

- Component tests cover each section, a null `paths`, and a banner with and without a newer release.
- Writes go through the guarded routes and show a refusal clearly.
- It runs against the fake bridge in the compiled executable.

## Handoff

Branch `t3/viewer-settings-about-screens`, wip commit on top of b253ec0 (see `git log -1`). Thread 1 hit the 150k context limit before the first audit. Audit round count so far: 0.

**Done** (typecheck clean, `bun test viewer` 196 pass, Biome clean):
- `viewer/src/internal-api.ts`: `call` plus typed wrappers for `/settings`, `/adapters`, `/adapters/probe`, `/adapters/switch`, `/manual-picks`, `/manual-picks/forget`, `/about`, `/update`; `refusalCopy`. Local `ManualPicksBody` mirrors amendment 021 item 8 because `GET /manual-picks` is ticket 108's and doesn't exist yet (404 shows "can't list candidate profiles yet").
- `settings-form.ts` (draft, patch, validate, lock by flag, LAN host, saves banner), `useInternal.ts` (polled reads), `SettingsScreen.tsx` (view plus controller), `ManualPick.tsx`, `UpdateBanner.tsx` (global banner, per-version dismiss), `About.tsx` (version, update, LGPL cards), `App.tsx` wiring, CSS at the end of `styles.css`.
- Tests: `settings-form.test.ts`, `internal-api.test.ts`, `update-banner.test.tsx`, `shell.test.tsx` Settings case, `testing.ts` `settingsBody` fixture.

**Left, in order**
1. Component tests with `renderToStaticMarkup` for `SettingsView` (each section, flag-locked field, restart note, LAN warning, null `paths` vs set, refused-saves banner, `AdapterList` auto vs pinned, `NoticeView` error) and `ManualPickSection` (no ROM, expansion, auto match, manual match with forget, candidates, 404) in a new `settings.test.tsx`. Extend `about.test.tsx` for the version and update cards.
2. Compiled-executable test `server/test/e2e/settings-executable.test.ts` (pattern: `battle-executable.test.ts`, runs only when `PMR_EXECUTABLE` is set): GET `/settings`, `/about`, `/update`, `/adapters`, a bad-Host PUT refused 403, and the served viewer code carries the Settings and About strings. Try `bun build --compile` locally (`bun run build:exe`) and run it with `PMR_EXECUTABLE=out/pokemon-memory-reader`.
3. Council audit, Claude seat only ("Gemini and GPT: not run"), up to five rounds.
4. Decision report `.plan/maps/v2-build/assets/085-viewer-settings-and-about-report.md` (unslop), Answer section, Timing close, push without force, PR against `wayfinder/v2-build-master`.

**Decisions to put in the report:** one Save form with per-field patch, drafts never overwritten by polls; flag-locked fields disabled; icon section left to its own ticket (087); manual pick control built against the amendment's GET body with a 404 fallback; update banner global in `App`.

**Open audit problems:** none yet. Read first: `SettingsScreen.tsx`, `settings-form.ts`, `internal-api.ts`.
