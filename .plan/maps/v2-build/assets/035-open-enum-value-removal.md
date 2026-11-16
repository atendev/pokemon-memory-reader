# Open enum value removal: amendment for spec §7.11 and §10

Resolves [May an open enum lose a value within `/api/v2`?](../tickets/035-open-enum-value-removal.md).

This was decided in auto mode on 2026-11-16 (UTC). The main thread asked three rounds of questions with a recommendation each, and a grilling subagent stood in for the owner. It accepted every recommendation and added the clauses marked *(owner stand-in)*. Those are the subagent's additions, not the owner's own words. When the spec text is next updated, §7.1, §7.11, §10 and §13.7 cite this amendment. This ticket doesn't edit the spec. The [decision report](./035-open-enum-value-removal-report.md) lists every decision.

"Open enum" means every enum on §7.11's open list: error `code` (including `no_data` and `invalid_topics` from amendment 020), `dataFormat`, adapter `id`, topic names, `status.adapter.problem`, `status.adapter.bridge.bridge`, and `battle.modes` (amendment 015).

## Amendment

1. **The contract is append-only for every open enum.** Inside `/api/v2`, a shipped name is never removed from the known union or the contract docs, never renamed, and never given another meaning. Removing a name from the known union or the docs, or renaming it, waits for `/api/v3`. Stopping emission while the name stays listed is a separate matter, covered by item 4. "Open" means clients tolerate new names, not that known names may disappear. A client that matches `code === "no_game"` or switches on adapter `id` must keep matching. This extends 015 item 1 to all open enums.

   - **Fixing meaning text.** 015 item 8's path applies to every open enum. A wording-only edit to a shipped meaning goes through its own amendment ticket, which confirms the meaning is unchanged and updates the record and the baseline file (item 7) in the same commit. The documented meaning is the contract. When the server's emission disagrees with it, the emission is fixed, which is a patch release of the app (015 item 4). When the documented meaning itself turns out to be the wrong one, it stays as written and the name keeps being emitted under it until `/api/v3`. No second name is added for the same condition (item 2).

2. **No rename aliases.** A rename counts as a removal plus an addition. The server keeps emitting the old name. A new name whose meaning is the same as, or a rename of, an existing name's meaning is not added. This extends 015 item 3.

3. **When the rule binds.** A name becomes contract in the first stable release that ships it, either `v2.0.0` and `api-v2.0.0`, or a later stable `2.x.y`. A name that has shipped only in prereleases (`-beta.N`, `-rc.N`) may still be renamed or removed before the matching stable release, with a changelog note. After a stable release, a later prerelease may change only the names it introduced itself. This refines 015 item 4's "when its value first ships" and 015 item 8's "previous release" to mean the last stable release.

4. **Retiring a name (stopping emission).** The server may stop emitting a name while it stays in the known union and docs. This depends on the enum:
   - **Topic names are never retired.** A topic is a resource route that clients request and fetch, so retiring one removes a route.
   - **Error `code`, `problem`, adapter `id`, `bridge.bridge` and `dataFormat`** may be retired only when the thing the name stands for no longer exists in the program. That means the condition can no longer occur, or support for that emulator, bridge or data format was dropped. A condition or thing that still exists keeps its name and is never reported under a different value.
   - *(main thread)* **`battle.modes`** follows the same rule. A tag may be retired only when no battle the program can read can satisfy its predicate, for example after support for the only generation that has that battle kind is dropped. While such a battle can still be read, 015 item 4 requires the tag.
   - A retired name stays in the known union and the contract docs, marked retired, and is never reused for another meaning *(owner stand-in)*.

5. **Release rules.**
   - **Adding a name** to any open enum is a minor release of the app and of `@pokemon-memory-reader/api`. The server emission, the known union, the record (item 6) and the docs change in the same release. Each new name needs its meaning line. A new `dataFormat` also needs the fixture that verifies it, as 015 item 2 requires for `modes`. This extends 015 item 7.
   - **Retiring a name** is a minor release of the app, with a "Retired" changelog entry that names the value and the reason. The package gets a minor release in the same cycle, which sets the name's `retiredIn` field to the app version (item 6).
   - A mapping fix that brings emission back in line with a documented meaning stays a patch release of the app only (015 item 4).

6. **Meaning records.** The API package keeps one record per open enum, mapping each name to a one-line meaning plus an optional `retiredIn` app version. For error `code`, the meaning is the "When" condition from §7.2. For topics, it is the resource the topic names. `battle.modes` keeps its 015 record in this same form. The TypeScript known union is derived from each record's keys, `TOPICS` included, and the contract docs render the records. `retiredIn` is separate from the meaning text, so retiring a name never edits frozen text.

7. **The append-only test.** One test covers every open enum, including `battle.modes`, and replaces 015 item 8's per-enum test.
   - **Baseline.** A committed JSON file in `api/` holds every record's names, meaning texts and `retiredIn` values. It is rewritten in the release commit of a stable `api-v` tag, as a `RELEASING.md` step. The only other edit allowed is a wording-only meaning fix under item 1, which updates the record and the baseline together in its own amendment's commit. Before `api-v2.0.0` the file doesn't exist, and the test skips with a visible message (item 3).
   - **Check.** Every baseline name must still exist with identical meaning text, and every `retiredIn` that is set in the baseline must be unchanged. New names pass, and so does setting `retiredIn` on a name whose baseline value is unset. The check is a subset comparison, not equality, so it fails on a removal or meaning edit made in the records. A baseline file rewritten to match such an edit would pass, so the `RELEASING.md` step and review guard every edit to the baseline file. A unit test can't detect that case.
   - **Coverage.** The test also checks that the open-enum list in the contract docs equals the set of records, so a new open enum can't ship without a record *(owner stand-in)*.
   - Not a Bun snapshot. `--update-snapshots` would accept a removal as easily as an addition.
   - The closed-enum snapshot test (§7.11) is unchanged.

## Spec text this amends

- §7.1, versioning: "with only additive changes inside it" stays. Add that open-enum names follow amendment 035.
- §7.11: after the open-enum list, add "Each open enum is append-only within `/api/v2`, and a name may stop being emitted only under amendment 035 item 4." The list gains `battle.modes` per 015.
- §10, forward compatibility: "Loose schemas and listed open enums (§7.11)" gains "with a meaning record per open enum and an append-only test (amendment 035)".
- §13.7, `RELEASING.md`: a stable `api-v` release rewrites the open-enum baseline file.
- Amendment 015 items 4, 7 and 8 are refined by items 3, 5 and 7 here. The "Surfaced" note in 015 is resolved.

## Surfaced

- **Open-enum meaning records and append-only test** (task, unblocked). Move the six current open enums in `api/src/schemas.ts` from plain `z.string()` with no known union to records with a derived known union plus `(string & {})` type. That means error `code` (`disconnected`, `no_game`, `unidentified`, `unsupported`, `not_found`, `no_data`, `invalid_topics`), `dataFormat`, adapter `id`, topics, `problem` and `bridge.bridge`. Add the append-only test with its skip-before-baseline behavior and the docs coverage check, add the `RELEASING.md` baseline step, and render the records in the contract docs. `battle.modes` joins when the `battle` resource lands. It touches `api/src/types.ts` like [ticket 054](../tickets/054-zod-free-api-declarations.md), so the master may order the two, but neither blocks the other.
