# Battle modes enum: amendment for spec §17 item 3

Resolves [Is `battle.modes` an open enum?](../tickets/015-battle-modes-enum.md).

This was decided in auto mode on 2026-11-16 (UTC). The main thread asked each question with a recommendation, and a grilling subagent stood in for the owner and answered it. When the spec text is next updated, spec §7.8 (`battle`), §7.11, §11.4 and §12.7 will cite this amendment for §17 item 3. This ticket doesn't edit the spec. Points marked *(main thread)* fill in details the interview didn't ask about. The [decision report](./015-battle-modes-enum-report.md) lists every decision.

## Amendment

1. **`battle.modes` is an open enum.** It joins the open enums in §7.11. That covers `modes` on the active battle and on `lastBattle`.
   - The API package types each element as the known union plus `(string & {})` and validates it as a string.
   - A release under `/api/v2` may add a value. It never removes or renames one.
   - Clients must not fail or branch on a value they don't recognize. The contract docs say so.
   - §7.11's sentence "`battle.modes` conflicts with this rule" is dropped. The closed-enum rule stays as written for every enum not on the open list.

2. **Which values exist.** The server emits only values whose verification fixture (§12.7) has landed. The API package's known union and the contract docs list exactly the values that release's server emits. Unverified names are never pre-listed.
   - This replaces "dropped from the v2.0 enum" in §7.8's `modes` bullet and in §12.7, and "unverified modes left out of the enum" in §7.8's fallbacks. An uncaptured mode is left out of the known union until its fixture lands, then added in a later release.
   - Unknown flag bits are still ignored, and raw flag bits are still not exposed (§7.8).

3. **Adding a value.** A new name needs a contract amendment that states its meaning, and its fixture. It need not be one of today's six (`safari`, `link`, `tutorial`, `facility`, `roamer`, `legendary`). Gen 2's bug-catching contest and the Gen 1 and FireRed ghost battle were named in the interview as possible later names. They are examples, not commitments.
   - Names are lowercase snake_case and generation-neutral. One name means the same thing in every generation.
   - A new meaning must not be the same as, or a rename of, an existing tag's meaning. That is the only check against existing tags. Overlapping meanings are fine (item 5).
   - The server emission, the API package's known union and the contract docs change in the same release.

4. **Meaning, not bits.** Each value has a one-line, generation-neutral meaning in the contract docs, written as a yes/no predicate on the battle. The per-generation flag mapping is internal.
   - Fixing or widening a mapping so it matches the documented meaning is a bug fix in any release. That matches §12.7, where a fixture's internal correction is fixed in code.
   - Changing a shipped value's documented meaning is not allowed within `/api/v2`.
   - *(main thread)* A meaning becomes contract when its value first ships. Before that, the fixture work may still adjust it.

5. **Tags are independent.** A battle carries every tag whose predicate holds. They are not mutually exclusive and have no precedence order. A roaming Latias or Latios battle carries both `legendary` and `roamer`. The contract docs say tags can co-occur, and they write `legendary`'s meaning so the roaming case is clear.

6. **Array shape.** Values are unique and sorted in plain code-point (ASCII) order, not locale order. The array is empty when no mode applies. A stable order keeps change detection and SSE updates from firing on a reordering, and a new value needs no placement rule.

7. **Versioning.** Adding a `modes` value is a minor release of the program and of `@pokemon-memory-reader/api` (`api-v` tags), because it is new output. `/api/v2` stays. A mapping fix under item 4 is a patch release of the program only. *(main thread)* The mapping lives in the server, so the API package doesn't change and gets no release for it.

8. **Tests.**
   - The closed-enum test (§7.11) excludes `modes`.
   - A new append-only test checks the known `modes` list against the previous release's list. It fails if a value is removed or renamed and passes when one is added.
   - *(main thread)* The API package keeps the known values as a record from each name to its one-line meaning, which the contract docs render. The append-only test also fails if a shipped value's meaning text changes, so a test enforces item 4's rule. The test is strict on purpose. Even a wording-only edit to a shipped meaning fails it, and goes through its own amendment ticket that confirms the meaning is unchanged and updates the recorded text. A meaning that was wrong before its value shipped can still change (item 4).
   - The append-only rule covers `modes` only. Whether the other open enums may lose a value within `/api/v2` is a separate question this ticket doesn't decide (see "Surfaced" below). §7.11 makes no new claim about them.

9. **Viewer.** The trainer card and the wild encounter header (§11.4) show each known tag with its label. An unknown tag shows as its raw string, not skipped. That only happens with a version mismatch, since the viewer ships with the program.

## Spec text this replaces

- §7.8, `modes` bullet: "draws from a fixed enum mapped from each generation's flags" becomes "an open enum of generation-neutral tags (§7.11, amendment 015)". "Is dropped from the v2.0 enum" becomes "is left out of the known union until its fixture lands". The last sentence ("Whether this enum may gain values within `/api/v2` is contested...") is removed.
- §7.8, "Fallbacks until the verification fixtures land": "unverified modes left out of the enum" becomes "unverified modes left out of the known union".
- §7.11: `battle.modes` joins the open-enum list, and its conflict sentence is removed.
- §12.7: "A mode that can't be captured is dropped from the v2.0 enum" becomes "A mode that can't be captured stays out of the known union until its fixture lands".
- §17 item 3 is resolved by this amendment.

## Surfaced

- **May an open enum lose a value within `/api/v2`?** (grilling, unblocked). §7.11 doesn't say whether error `code`, `dataFormat`, adapter `id`, topic names, `status.adapter.problem` or `status.adapter.bridge.bridge` may drop a value. The API package build needs the answer before it writes the contract docs.
