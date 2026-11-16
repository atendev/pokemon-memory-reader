---
type: grilling
blocked_by: []
claimed_by: wayfinder-master v2-build-master-1794807670
claimed_at: 2026-11-16T05:41:45Z
---

# How do prereleases ship while main stays untouched?

## Question

Spec §17 item 12. `release.yml` fails a tag that isn't reachable from `origin/main`, but this map keeps main untouched until the final release. Decide how `v2.0.0-beta.1` and the release candidate ship.

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

Prerelease tags ship from the integration branch, and main stays on v1 until the final release ticket. Decided in auto mode. The full text is in [the amendment](../assets/024-prereleases-without-main.md), and the decision report is [here](../assets/024-prereleases-without-main-report.md).

- One shared `scripts/check-release-ref.ts` gates `release.yml` and `release-api.yml`. A stable tag must be reachable from `origin/main`. A prerelease tag must be reachable from `origin/main` or from the branch named by a `PRERELEASE_BRANCH` constant, set to `wayfinder/v2-build-master`. The check fails if that branch is missing. The gate catches mistakes, and push access is the real control.
- The script checks the tag's version against `server/package.json` for `v*` tags and `api/package.json` for `api-v*` tags. It fails a stable tag while the constant is still set. It also fails release-body links to this repo pinned to any ref other than the tag being released.
- At v2.0.0, the constant is deleted and the 2.0.0 bumps land on the integration branch. Main then fast-forwards, or takes a merge commit if it has moved, and never squashes or rebases. `v2.0.0` and `api-v2.0.0` are tagged on main's new head.
- A fix after a failed checklist lands on the branch the tag was cut from. Releases start only from tag pushes and never need `workflow_dispatch`. `ci.yml` keeps no branch filter, and the Bun-upgrade smoke matrix runs on path-filtered `pull_request` events.
- Dependabot stays off until v2.0.0 reaches main. Until then, `RELEASING.md` has a manual action SHA check before each prerelease. Prereleases can't take the Latest label, and the owner sets it when publishing `v2.0.0`.

Excluded: merging to main per prerelease, skipping the check for prereleases, a repository variable or `next` mirror branch, keeping the constant after v2.0.0, an unchecked `release-api.yml`, squash or rebase merges, release-body links to `main` or the branch, and committing `dependabot.yml` to main early.
