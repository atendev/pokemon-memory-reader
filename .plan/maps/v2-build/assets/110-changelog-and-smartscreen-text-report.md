# Decision report for the README SmartScreen text and `CHANGELOG.md`

Ticket 110. Branch `t3/readme-smartscreen-changelog`. The council ran with the Claude seat only, because the Gemini and GPT seats are out of quota. Auto mode is on, so no question went to the user.

## Decisions

1. **How does the release body link to the README?**
   - Options: leave the notes as plain text, or link to README anchors.
   - Choice: link. The notes now point at `README.md#windows-smartscreen` and `#macos-quarantine`, and `buildBody` fills `{{repo}}` and `{{tag}}` before the link lint runs, so every link is pinned to the tag.
   - Made by: main thread. Council: not contested.

2. **What does the `CHANGELOG.md` stub hold?**
   - Choice: a `## 2.0.0-beta.1` heading with "Not released yet" and empty Highlights and Fixes lists. `changelogSection` finds it, so the body step passes. The release candidate rewrites it.
   - Made by: main thread.

3. **What does the README say?**
   - Choice: a "Running a downloaded build" section with Windows SmartScreen steps (More info, Run anyway), macOS quarantine, and the supported targets. It matches `scripts/release-notes.md`.
   - Made by: main thread.

4. **How does the test keep links honest?**
   - Choice: it builds the real body from the committed `CHANGELOG.md`, `README.md` and notes, collects every `README.md#anchor` link, and checks each against GitHub-style heading slugs. It also requires the SmartScreen anchor to be present, and that no `{{` placeholder survives.
   - Made by: main thread. Round 1 raised two fragility problems (a hardcoded "Not released yet" assertion, a regex fixed to one tag), both fixed.

## Audit

APPROVE in round 2, Claude seat only (score 8). Gemini and GPT: not run.

Declined minor problems: (a) the README's `SHA256SUMS` advice, since the `draft` job writes and attaches that file (ticket 089); (b) the test regex no longer pins the tag, since `lintBodyLinks` inside `buildBody` already rejects unpinned links and has its own tests.

## Checks

`bun test`: 1644 pass, 1 fail. The failure is the Lua 5.3/5.4 core test, because Lua isn't installed on this machine. It is unrelated to this change. Typecheck and Biome pass.

## Not done

`api/CHANGELOG.md` for the API package release isn't part of this ticket.
