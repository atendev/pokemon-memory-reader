# Decision report: How do prereleases ship while main stays untouched?

This report covers [ticket 024](../tickets/024-prereleases-without-main.md). Its decisions are recorded in [the amendment](./024-prereleases-without-main.md).

This ran in auto mode under wayfinder-master. The main thread wrote the questions and a recommendation for each. A sonnet grilling subagent answered them over three rounds, and a haiku auditor checked the amendment. The master's brief skips the commit gate and commits every time. Nothing merges from this branch.

Facts the main thread checked before round 1: `origin/main` (064d0a4, the v1 tree) is an ancestor of `wayfinder/v2-build-master`. `ci.yml` triggers on `push` to `**` and on unfiltered `pull_request`. The main thread also read the text of spec §13.6, §13.7, §13.8 and §13.9.

## Decisions

| # | Question | Options | Choice | Made by |
|---|---|---|---|---|
| 1 | How does `release.yml` decide a tagged commit may be released? | stable from main and prerelease from main or a `PRERELEASE_BRANCH` constant; skip the check for prereleases; a repository variable; merge to main per prerelease; a mirrored `next` branch | The constant, set to `wayfinder/v2-build-master`, failing closed if the branch is missing | Grilling subagent, accepting the recommendation |
| 2 | Does `release-api.yml` get the same check? | a shared script; no check | The shared `scripts/check-release-ref.ts` | Grilling subagent |
| 3 | Does the API tag have to match `api/package.json`? | yes; rely on npm | Yes. The same script checks `server/package.json` for `v*` and `api/package.json` for `api-v*` | Grilling subagent (raised it in round 1, settled in round 2) |
| 4 | What happens to `PRERELEASE_BRANCH` at v2.0.0? | delete it before main moves; keep a permanent slot | Delete it. The script fails any stable tag while the constant is set, `RELEASING.md` lists the removal, and `bun test` covers the rule table | Grilling subagent (asked for enforcement in round 1, settled in round 2) |
| 5 | How does the integration branch reach main? | fast-forward, else a merge commit; squash; always a merge commit | Fast-forward if main hasn't moved, else a merge commit. Never squash or rebase | Grilling subagent |
| 6 | Where does a fix land after a failed prerelease checklist? | the branch the tag was cut from | The integration branch before v2.0.0, main after | Grilling subagent |
| 7 | How do links work while main shows v1? | tag-pinned links; integration-branch links; unchanged | Relative links in the README. Absolute links in release bodies, which must name the tag being released, checked by the script | Grilling subagent, then the main thread tightened the check to match the tag after audit round 1 |
| 8 | What about Dependabot, which reads config only from the default branch? | accept it until v2.0.0; add config to main now | Accept it. `dependabot.yml` lives on the integration branch, and a prerelease-only `RELEASING.md` item covers manual action SHA bumps | Grilling subagent |
| 9 | Can a release step rely on `workflow_dispatch`? | no; flag as irrelevant | No. Releases start only from a tag push, and failed runs are re-run | Grilling subagent |
| 10 | Does `ci.yml` need a change? | none; add a branch filter | None. It must keep no branch filter | Grilling subagent |
| 11 | What triggers the Bun-upgrade smoke matrix? | `pull_request` with a path filter; a manual run per prerelease | `pull_request` with a path filter and no branch filter. The build ticket that adds it owns the details | Grilling subagent |
| 12 | Does the update check need a change? | flag as not applicable; keep a note | Not applicable. The grilling subagent withdrew its "channel setting" note, because §9.8 decides by build kind | Grilling subagent |
| 13 | How is the Latest label handled? | an explicit rule; GitHub's default | Prereleases can't be Latest (cited from GitHub's REST docs). The owner sets Latest when publishing `v2.0.0`, and `RELEASING.md` checks it | Grilling subagent, then the main thread replaced the draft `make_latest` claim with the docs quote after audit round 1 |
| 14 | What does the reachability gate protect against? | state it is a guard against mistakes; move to a repository variable; fetch the script from another branch | A guard against mistakes. Push access is the control, and the same was true of the original main-only check | Main thread, answering audit round 1 |
| 15 | When do prerelease and `2.0.0` version bumps happen, and when is `api-v2.0.0` tagged? | (gap the audit found) | Each bump and changelog section lands on the integration branch before its tag. `v2.0.0` and `api-v2.0.0` are both tagged on main's new head | Main thread, answering audit round 1 |

## Audit

- Round 1: five problems. The reason given for rejecting a repository variable didn't hold. The prerelease version bumps weren't specified. The draft `make_latest` claim had no evidence. The `api-v2.0.0` order was missing. Links pinned to a stale tag would pass the check. The main thread fixed all five (decisions 7, 13, 14 and 15).
- Round 2: APPROVE. All five objections were resolved. The auditor added one minor note: the check needs a defined test for which URLs count as this repo. The amendment now defines them by `https://github.com/${GITHUB_REPOSITORY}/`.

## Surfaced

None. The amendment feeds the existing `v2.0.0-beta.1` fog entry. The build ticket for the release pipeline builds the script, the `RELEASING.md` items and `dependabot.yml`.
