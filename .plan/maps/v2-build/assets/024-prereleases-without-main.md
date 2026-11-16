# Prereleases without main: amendment for spec §17 item 12

Resolves [How do prereleases ship while main stays untouched?](../tickets/024-prereleases-without-main.md).

These were decided in auto mode on 2026-11-16 (UTC). The owner handed every question to the runner's Auto mode loop: the main thread asked each question with a recommendation, and a grilling subagent answered it. The main thread then added the threat-model note in item 1, the version-bump steps in items 2 and 4, the tag-match link rule in item 6 and the cited Latest rule in item 9 to answer the audit. When the spec text is next updated, spec §13.2, §13.6, §13.7, §13.8 and §13.9 will cite this amendment for §17 item 12. The source ticket [Release pipeline](../../v2-rebuild/tickets/017-release-pipeline.md) will get an "Amended by" pointer to it at the same time. This ticket edits neither the spec nor that ticket. Each numbered item below replaces or adds to the text it names.

**The integration branch** means `wayfinder/v2-build-master`, where the build map assembles v2. Main still holds the v1 tree (`064d0a4`, tagged `v1-lua`), and `origin/main` is an ancestor of the integration branch today.

## Amendment

1. **Which commits may be released (§13.6, §13.8).** One shared script, `scripts/check-release-ref.ts`, gates both `release.yml` and `release-api.yml`. It replaces §13.6's "fails if the tagged commit isn't reachable from `origin/main`".
   - A **stable** tag, meaning one whose version has no `-`, must be reachable from `origin/main`.
   - A **prerelease** tag must be reachable from `origin/main` or from the one branch named by a `PRERELEASE_BRANCH` constant at the top of the script, set to `wayfinder/v2-build-master`.
   - The allowed branch lives in code, so review sees it. It is not a repository variable.
   - **What the gate protects against.** A tag-push run uses the workflow file and script at the tagged commit (item 8). A tagged commit could change `PRERELEASE_BRANCH`, or drop the check altogether. That was already true of §13.6's main-only check. So this gate catches mistakes, such as tagging a feature branch or a stale commit. It is not a control against someone who can push tags. That control is push access: only the owner can push tags to this repo. A repository variable wouldn't change this, because the tagged workflow could ignore it. Reading the script from another branch at run time would add moving parts and still leave the tagged workflow file in charge.
   - If the named branch doesn't exist on origin, the check fails. It never falls back to skipping the check.
   - Both workflows check out with full history (`fetch-depth: 0`) so the ancestry test can run.
   - `release-api.yml` had no check in §13.8. It now has one, because the API `2.0.0` prereleases (beta and rc) ship from the integration branch too, and the two workflows shouldn't disagree about what may be released. A prerelease API version goes to `next` and a stable one to `latest`, as before.

2. **Version match (§13.6, §13.8).** The same script takes a package.json path and fails when the tag's version differs from the file's `version`. It reads `server/package.json` for `v*` tags, as §13.6 already says, and `api/package.json` for `api-v*` tags, which is new. npm publishes whatever `api/package.json` says, so without this check a mismatched tag would ship a different version than its name.
   - Before each prerelease tag, the version bump and its changelog section land on the integration branch through the usual merge: `server/package.json` and `CHANGELOG.md` become `2.0.0-beta.1` (later `2.0.0-rc.N`) for a `v*` tag, and `api/package.json` and `api/CHANGELOG.md` do the same for an `api-v*` tag. The tag then goes on that commit.

3. **Retiring `PRERELEASE_BRANCH` at v2.0.0.** The final release ticket deletes the constant before main moves. After that, main's workflows allow main only, and later prereleases such as `v2.1.0-beta.1` ship from main.
   - The script fails any stable tag while `PRERELEASE_BRANCH` is still set, and its message names the constant. So `v2.0.0` can't ship until the constant is gone. A unit test can't tell when release time is, but this check runs at exactly that moment.
   - `RELEASING.md` lists the removal as an item for the `v2.0.0` run.
   - `bun test` covers the script's rule table: stable or prerelease, reachable from main, from the branch or from neither, the constant set or empty, a version that matches or doesn't, and a release body with or without a banned link (item 6).

4. **Reaching main (§13.9).** §13.9's "v2 development merges to main" becomes: "v2 development integrates on `wayfinder/v2-build-master` and reaches main once, in the final release ticket, by fast-forward or merge commit."
   - Fast-forward main to the integration branch if main hasn't moved. Otherwise use a merge commit. Never squash or rebase, so every beta and rc tag commit stays reachable from main.
   - The `2.0.0` version bumps and changelog sections, for the app and the API, land on the integration branch first, along with the `PRERELEASE_BRANCH` removal (item 3). Then main moves, and `v2.0.0` and `api-v2.0.0` are both tagged on main's new head. Both are stable tags, so the script rejects either one pushed before main moves. `RELEASING.md` lists this order for the v2.0.0 run.
   - The workflow filenames stay the same. npm trusted publishing is bound to `release-api.yml` by name (§13.8), so renaming it would break publishing.

5. **Where a fix lands (§13.7).** §13.7's "the fix lands on main" becomes "the fix lands on the branch the tag was cut from: the integration branch before v2.0.0, main after." The next RC or patch is cut from the same branch. The rules to delete only the draft and never move or delete a pushed tag stay.

6. **Links.** Main shows v1 until v2.0.0, so a `blob/main/...` link from a v2 prerelease would open v1 files.
   - The v2 README uses relative links, which resolve against whichever ref is being viewed, the tag included.
   - Release bodies come from `CHANGELOG.md` and `api/CHANGELOG.md` sections. GitHub doesn't resolve relative links in a release body, so they use absolute `blob/<tag>/...` links.
   - In both workflows, the check script fails when the changelog section that becomes the release body has a link to this repo (`https://github.com/${GITHUB_REPOSITORY}/`) whose path continues with `blob/<ref>/` or `tree/<ref>/` where `<ref>` isn't the tag being released. That catches `main`, the integration branch, and a stale tag carried over from an earlier rc. The README isn't linted, since it has no absolute links to check.
   - The update banner already links to the release page (§9.8), so it needs no change.

7. **Dependabot (§13.2).** Dependabot reads `.github/dependabot.yml` only from the default branch, so it can't run while main holds v1, and main is not touched for it.
   - `dependabot.yml` lives on the integration branch and starts working once v2.0.0 reaches main.
   - Until then, `RELEASING.md` has a prerelease-only item: before tagging a beta or rc, check each pinned action in `.github/workflows/` for a newer release or a security advisory, and bump the SHA on the integration branch if needed. The final release ticket removes the item.

8. **Triggers.** Releases start only from a tag push. A tag-push run uses the workflow file at the tagged commit, so `release.yml` and `release-api.yml` work from the integration branch.
   - A failed run is retried with GitHub's re-run, not with a new or moved tag.
   - GitHub only offers `workflow_dispatch` for workflow files on the default branch, so no release step depends on it before v2.0.0.
   - `ci.yml` keeps its trigger with no branch filter (`push` on `**` and `pull_request`). A future filter must not name the integration branch.
   - The full release smoke matrix that §13.2 requires for a Bun upgrade runs on `pull_request`, filtered by path to the files that pin the Bun version, with no branch filter. A Bun-upgrade PR into the integration branch runs it before v2.0.0, and one into main runs it after. It never relies on `schedule` or `workflow_dispatch`. The build ticket that adds the release matrix owns the details.

9. **The Latest marker (§13.6).** GitHub's REST docs for [creating a release](https://docs.github.com/en/rest/releases/releases#create-a-release) say of `make_latest`: "Drafts and prereleases cannot be set as latest." Betas and rcs are marked prerelease (§13.6), so they never take the label, and before v2.0.0 it stays on `v1.2.0`, which is correct. The plan doesn't depend on what `make_latest` does on a draft. When the owner publishes the `v2.0.0` draft, they tick "Set as the latest release". `RELEASING.md` adds an item for the stable run: after publishing, check that `v2.0.0` is a non-prerelease and is marked Latest.

Not changed: the update check (§9.8) reads the release list through the API, which hides drafts, and it compares by build kind. Nothing in it depends on branches. npm provenance records the tag ref and is branch-independent.

## Excluded

- Merging to main at each prerelease, which breaks the build map's rule.
- Skipping the reachability check for prereleases.
- Allowed branches in a repository variable, or a mirrored long-lived `next` branch.
- Keeping `PRERELEASE_BRANCH` as a permanent slot after v2.0.0.
- Leaving `release-api.yml` without a reachability or version check.
- Squash or rebase merges of the integration branch into main.
- Release-body links pinned to any ref other than the tag being released.
- Treating the reachability gate as a security control.
- Committing `dependabot.yml` to main early, with or without `target-branch`.
- Any release step that needs `workflow_dispatch` before v2.0.0.
- Relying on GitHub's default Latest choice.
