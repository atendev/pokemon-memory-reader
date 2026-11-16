---
type: grilling
blocked_by: []
assets:
  - ../assets/015-battle-modes-enum.md
  - ../assets/015-battle-modes-enum-report.md
claimed_by: wayfinder-master v2-build-master-1794792924
claimed_at: 2026-11-16T03:04:46Z
---

# Is `battle.modes` an open enum?

## Question

Spec §17 item 3. The battle tracker and fixtures tickets add modes later without a breaking change, but the Importable package decision closes every enum it doesn't list. Decide which rule `battle.modes` follows.

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.

## Answer

A grilling subagent decided this in auto mode on 2026-11-16, and the audit approved it in round 3. The full amendment, which spec §7.8, §7.11, §11.4 and §12.7 will cite, is in [015-battle-modes-enum.md](../assets/015-battle-modes-enum.md). The decision report is [015-battle-modes-enum-report.md](../assets/015-battle-modes-enum-report.md).

- `battle.modes` (on the active battle and `lastBattle`) is an open enum. The API package types each element as the known union plus `(string & {})`. A release under `/api/v2` may add a value but never removes or renames one, and clients must not fail or branch on an unknown value.
- The server emits only values whose verification fixture has landed. The known union and the contract docs list exactly those values. An uncaptured mode stays out of the union until its fixture lands.
- A new name may go beyond today's six. It needs a contract amendment that gives its meaning, plus its fixture. Names are lowercase snake_case and generation-neutral.
- Each value has a documented yes/no meaning, and the flag mapping is internal. A mapping fix toward the meaning is a patch of the program. A shipped meaning never changes within `/api/v2`.
- Tags are independent, so a battle carries every tag whose meaning holds. The array is unique, sorted in code-point order, and empty when no mode applies.
- Adding a value is a minor release of the program and the API package. The closed-enum test excludes `modes`. An append-only test fails if a shipped name or its meaning text changes. The viewer shows an unknown tag as its raw string.

Why: the spec drops uncaptured modes from v2.0 rather than block the release, and that only works if adding them later isn't breaking. `modes` is a tag set clients test for membership, so an unknown tag does no harm. Excluded: a closed enum of the v2.0 values, a closed enum of all six names, mutually exclusive tags, and any rule for whether the other open enums may lose a value. That last question goes to its own ticket.
