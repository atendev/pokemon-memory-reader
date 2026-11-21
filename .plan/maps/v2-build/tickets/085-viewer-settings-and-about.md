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

## Answer

Settings is one form with a per-field patch (`viewer/src/SettingsScreen.tsx`, `settings-form.ts`, `settings-actions.ts`). A 5 s poll never overwrites a draft, fields a flag set are disabled, restart-only fields say so, and a non-loopback bind address warns. A live "Adapters now" section lists each probe result with a run-only switch and Check again, and the manual pick control lists candidates and forgets a pick. `paths` shows only when not null. About shows the version line, the update summary and the LGPL lines with the notices link, and the update banner reads `/update` globally with a per-version dismissal. Every write shows the program's refusal with a title by code. `GET /manual-picks` is ticket 108's, so the pick control reads a local mirror of the amendment's body and says "can't list candidate profiles yet" on a 404. The Settings icon section stays with its own ticket. The compiled-executable test passes 8 of 8 on the fake bridge. Audit: Claude seat only, approved at round 2 with a score of 8. [Report](../assets/085-viewer-settings-and-about-report.md).

Timing: wall 13m, active 13m, user 0s, wait 0s, blocked 0s | implement 7m, audit 2m (2 rounds), fix 58s, gate 51s | tools 95 (9 subagent) | limits 0, compactions 0, handoffs 1 | ctx peak 158k | cost $3.78 sonnet-5-5 + $0.03 haiku-5-5
