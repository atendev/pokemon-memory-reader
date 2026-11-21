# Viewer Settings and About screens: decision report

Ticket: viewer Settings and About screens. Spec: §11.7. Branch: `t3/viewer-settings-about-screens-1`, cut from the first attempt's work-in-progress commit `e9c1848`. Audit: Claude seat only. The Gemini and GPT seats were out of quota, so they did not run.

## Audit verdict

APPROVE at round 2. Claude seat 8, Gemini and GPT not run. Round 1 scored 7 with one blocking problem: the stateful screen had no test, so "polls never overwrite a draft" and "writes show refusals" were unproven. It is fixed. Three minor problems from round 1 were fixed and one rebutted. Round 2 raised five minor problems. All five are declined.

## Spec check

§11.7 and amendment 021 decide the content, the routes and the error codes. `GET /manual-picks` belongs to ticket 108 and does not exist yet, which is the one gap. No grilling ticket was needed, since the amendment already gives the body shape.

## Decisions

1. **One Save form.** Question: save each field on change, or one form. Choice: one form with a per-field patch, so a save sends only what changed. Made by: implementer.
2. **Drafts and polls.** Question: what a 5 s settings poll does to a half-typed form. Choice: the draft starts from the first read and changes only on a save or Discard (`adoptDraft`). Made by: implementer. A unit test covers it.
3. **Flag-locked fields.** Choice: a field whose source is a flag is disabled with a line saying why, and the patch never sends it. Made by: implementer.
4. **Restart-only settings.** Choice: port, bind address and the browser setting say "Restart to apply" and show a saved-but-pending value. Made by: implementer.
5. **LAN bind warning.** Choice: any non-loopback bind address shows a warning that other devices can read game data. Made by: implementer.
6. **Adapter picker.** Choice: the pin lives in the form. A live "Adapters now" section lists the probe result of each adapter, a run-only switch and Check again. Switch and Check again are disabled or hidden while pinned. Made by: implementer, from amendment 021 items 5 to 7.
7. **Manual pick against a route that doesn't exist.** Question: build the control now or wait for ticket 108. Options: wait, or build against the amendment's body. Choice: build against a local `ManualPicksBody` mirror, with a "can't list candidate profiles yet" message on a 404. Made by: implementer. Follow-up: swap the mirror for the exported type when 108 lands.
8. **Paths.** Choice: shown when not null, otherwise "Open the viewer on this machine to see the path" (amendment 021 item 13). Made by: implementer.
9. **Update banner.** Choice: global in `App`, reads `/update` on load, every 30 min and on the `pmr:update-refresh` event a save of `updateCheck` fires. Dismissal is per version in `localStorage`. The release link is shown only for http and https URLs. Made by: implementer.
10. **About.** Choice: version line, build and commit, update summary and the LGPL lines with a link to `/about/third-party-notices.txt`. Made by: implementer.
11. **Icon section left out.** Choice: the Settings icon section stays with its own ticket. Made by: implementer.
12. **Writes moved out of the component** (audit fix, round 1). Choice: `settings-actions.ts` holds each write and its notice, so the refusal paths are unit-tested with a fake fetch. Made by: main thread, after the council's blocking problem.
13. **Poll race** (audit fix). Choice: `set` also restarts the read, so a poll in flight during a save is dropped rather than restoring the old value. Made by: main thread, after a round 1 minor problem.
14. **Double read on mount** (audit fix). Choice: the pick reload effect skips the first run. Made by: main thread, after a round 1 minor problem.
15. **Executable test.** Choice: `settings-executable.test.ts` runs the compiled executable on the fake bridge: settings, about, update, adapters, an accepted write persisted to `config.json`, a probe, a write refused for a foreign Host header, and Settings and About strings in the served viewer. Made by: implementer.

## Declined minor problems (round 2)

- The `UPDATE_REFRESH_EVENT` dispatch and the `run` glue have no test. The flag and the listener are covered. The suite has no DOM, so the component itself can't be driven.
- `toEqual(... as never)` and the `kind === "ok" &&` assertions read less clearly on failure. Style only.
- A successful probe now says "Checked again." instead of clearing the notice. Deliberate, so the click gets an answer.
- `run()` has no try/finally. `call()` never throws, as its own tests show.
- The update banner tests were not in the diff. They exist in `viewer/src/update-banner.test.tsx`.

## Checks

Typecheck, Biome and `bun test viewer` pass (235 tests). The compiled-executable test passes 8 of 8 against `bun run build:exe`. The full `bun test` has one failure, the Lua 5.3 or 5.4 check in `server/test/bridge/core.test.ts`. It fails without this branch too, because no Lua is installed here.
