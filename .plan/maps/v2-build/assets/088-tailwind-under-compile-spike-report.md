# Decision report for Tailwind under `--compile`

Ticket 088, a spike. Branch `t3/tailwind-under-compile-spike`. The council ran with the Claude seat only (single mode, `haiku`), and auto mode is on. The experiments ran in a scratch copy of the repo outside the worktree, so the branch holds only documents. The findings are in [the note](./088-tailwind-under-compile-spike.md).

## Decisions

1. **Where to run the spike.**
   - Options: edit the viewer in the worktree and revert, or work in a scratch copy.
   - Choice: a scratch copy made with `git archive HEAD` in `/tmp`. The ticket forbids half-converted files, and the viewer must stay on plain CSS.
   - Made by: implementer.

2. **Which route to test first.**
   - Options: the `bunfig.toml` `[serve.static] plugins` line with the existing CLI compile, or the `Bun.build` API.
   - Choice: both, CLI first because it keeps CI unchanged. The CLI route ships raw `@theme` and `@tailwind`. The API route ships processed CSS and passes smoke.
   - Made by: implementer.

3. **Is the answer yes or no?**
   - Choice: yes through the `Bun.build` API, no through the CLI with the bunfig line. The conversion ticket must move the compile steps onto a build script. The note lists them: `build:exe`, `ci.yml` (`compile-smoke`, `rehost-smoke`), `release.yml` and the relink doc.
   - Made by: implementer. Council: not contested.

4. **Windows and macOS.**
   - Choice: no runtime check was possible here. The plugin runs in the host Bun at bundle time, and the Windows, macOS and linux-arm64 builds each hold the processed CSS. The note calls the same-behaviour expectation untested, and CI is the real check.
   - Made by: implementer.

5. **Whether to create the conversion ticket file.**
   - Choice: no. The brief says the master edits the map, so the report names the ticket by title and the master adds it.
   - Made by: implementer, following the brief.

6. **Is the `tailwindcss` package needed?**
   - Choice: no. The build passes with it removed, and the banner shows the plugin's own 4.1.14. The note says so and leaves the pin to the conversion ticket.
   - Made by: implementer.

## Audit

- Round 1: DISAPPROVE, 7. One blocking problem: the note named a build script that exists only in the scratch copy. Fixed by putting the script body in the note. Three minor problems fixed in wording (repo change list, cross-target evidence, two inferences stated as fact).
- Round 2: APPROVE, 8, with five minor problems. Three fixed in wording (the headline named only the bunfig route, "fails quietly" read against the warning, the `tailwindcss` pin claim). Two declined: the acceptance line about the repo's only change refers to code files, not the ticket and report the runner writes, and the variant commands in prose are enough because the note holds the script they differ from.

Skipped gates: the Jev audit (parent ran it), the CI steps 6 and 7 (the master runs CI on the merged batch), and the user's commit question (the brief says to commit).
