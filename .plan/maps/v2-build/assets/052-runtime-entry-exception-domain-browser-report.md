# Decision report: Runtime entry exception for domain-browser

Ticket: [Runtime entry exception for domain-browser](../tickets/052-runtime-entry-exception-domain-browser.md). It builds items 3 and 4 of [amendment 044](./027-third-party-license-allowlist.md#amendment-044-artistic-20-for-buns-domain-browser). Branch `t3/domain-browser-runtime-entry`. This ticket had no grilling, so every decision below was made by the main thread (the implementer) unless it names another maker.

## What was built

- `scripts/notices.ts` exports `RuntimeEntryException` and `RUNTIME_ENTRY_EXCEPTIONS`. The one item is `domain-browser@4.23.0`, `Artistic-2.0`, `amendment 044`, with the note text from the amendment word for word.
- `checkExpression` takes an optional list of extra IDs. A Bun manifest entry whose `name@version` equals an exception's `entry` gets that exception's ID added to the runtime tier for its own check. The rest of the expression still has to pass.
- npm closure entries and overrides still go through `checkExpression(..., "permissive")` with no extra IDs, so no exception can match them.
- A manifest read reports each exception whose `name@version` is not in the manifest as stale.
- `NoticeEntry` gains `note`. `renderNotices` prints it under the `Source:` line.
- The domain-browser manifest entry drops `blockedUntilAmendment`, uses the npm tarball URL as `source`, and its `notes` name the upstream tag and cite amendment 044.

## Decisions

1. **How the exception reaches the checker.**
   - Options: a module-level lookup inside `bunEntries`, or an options field. A module-level lookup would make the fixture tests, which read other manifests, report domain-browser as stale.
   - Choice: a required `NoticesOptions.runtimeEntryExceptions` field. `repoOptions` sets the constant and `fixtureOptions` sets `[]`. Made by the main thread.
2. **Extra IDs on `checkExpression`.**
   - Options: a third optional parameter, or a separate tier. The tiers must not change (amendment 044 item 1 and amendment 027 item 13).
   - Choice: an optional `extraIds` parameter that is added to the allowed set. Made by the main thread.
3. **Where the stale check runs.**
   - Choice: only when a Bun manifest is read. With `manifestPath: null` there is nothing to be stale against. Made by the main thread.
4. **Field names of an exception.** The amendment lists a `name@version`, an SPDX ID, the amendment and a note. They became `entry`, `spdx`, `amendment` and `note`. The pinning test fixes the exact contents.
5. **Test for the repo.** The repo test now expects only `bun_clap@1.4.2` blocked. The `bun-runtime.test.ts` blocked-list test expects `["bun_clap"]`. Both lines also change in ticket 051's branch, so the master has to reconcile them to an empty list when it merges both.
6. **Strict check.** On this branch `bun run notices --check --strict` fails on `bun_clap@1.4.2` only. The third acceptance point depends on ticket 051 and can be confirmed only after the master merges both branches.

## Audit

Two council rounds. Every problem is listed below.

- Round 1: claude 8 (APPROVE), gemini 10 (APPROVE), gpt 9 (APPROVE).
- Round 2 (confirming round after one test fix): claude 8 (APPROVE), gemini 10 (APPROVE), gpt 9 (APPROVE).

| # | Raised by | Problem | Outcome |
|---|---|---|---|
| 1 | claude, round 1 | An exception's ID is never checked against the entry's own expression, so an exception stays live if the entry stops using that ID. | Declined. Amendment 044 item 3 defines staleness only as a missing `name@version`, and an unused ID changes nothing for any entry. |
| 2 | claude, round 1 | The npm closure test passed with or without the exception, because the exception's ID did not match the package's license. | Fixed. The test uses `gpl-pkg@1.0.0` with an exception for `GPL-3.0-only` and asserts the problem list equals the list with no exception. |
| 3 | claude, round 1 | Strict check depends on ticket 051. | Not fixable here. See decision 6. |
| 4 | claude, round 1 | The blocked-list assertions conflict with ticket 051's branch. | Not fixable here. See decision 5. |
| 5 | claude, round 2 | The override test asserts only that an `(override)` problem exists. | Rebutted. A regression that applied exceptions to overrides would remove that problem, so the assertion fails then. The override fixture's ID is `Artistic-2.0`, which the permissive tier rejects. |
| 6 | claude, round 2 | Duplicate exception entries for one `name@version` are not rejected. | Declined. The pinning test fixes the constant's exact contents and only a reviewed amendment can change it. |
| 7 | claude, round 2 | The new required options field could break other constructors, and no typecheck was run. | Rebutted. `tsc --noEmit -p scripts` is clean, and `repoOptions` and `fixtureOptions` are the only constructors. |

## Checks run locally

- `bun test scripts`: 145 pass, 0 fail.
- `bunx biome ci .` and `tsc --noEmit -p scripts`: clean.
- `bun test` over the whole repo: one failure, `server/test/bridge/core.test.ts`, which expects Lua 5.3 or 5.4 and found Lua 5.5 on this machine. It is unrelated to this change. CI runs Lua 5.4.
- Review gates skipped: none. The Jev audit was skipped as the brief instructs.
