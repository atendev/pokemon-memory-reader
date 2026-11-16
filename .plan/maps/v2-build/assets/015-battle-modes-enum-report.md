# Decision report: Is `battle.modes` an open enum?

Ticket: [Is `battle.modes` an open enum?](../tickets/015-battle-modes-enum.md). Amendment: [015-battle-modes-enum.md](./015-battle-modes-enum.md).

## How this ran

The run used auto mode, as the wayfinder-master asked. The main thread ran the `grilling` and `domain-modeling` skills and wrote each round's questions, options and recommendations. One grilling subagent on `sonnet` stood in for the owner and took every decision. It ran no skill. The owner answered nothing in this run. The interview took three rounds.

One auditing subagent on `haiku` checked the amendment. It returned APPROVE in round 3 of 5. Every decision below carries that verdict.

`CONTEXT.md` has no entry for battle modes, and none was added. "Open enum" and "closed enum" are contract terms that spec §7.11 already defines. The main thread wrote no ADR, because the decision is easy to revisit before v2.0 ships and follows a rule the spec already has.

## Decisions

Each decision lists the question, the options, the choice and who made it.

1. **Open or closed.** The options were an open enum (known union plus `(string & {})`), a closed enum of the values verified at v2.0, or a closed enum of all six candidate names. The grilling subagent chose open. The spec drops uncaptured modes from v2.0 rather than block the release, and that only works if adding them later isn't breaking. With no ROMs on hand, most modes will verify after v2.0. `modes` is a tag set clients test with `includes`, so an unknown tag does no harm. A value is never removed or renamed within `/api/v2`.

2. **Names beyond the six.** The options were any new name through a contract amendment plus fixture, or the six as the whole vocabulary. The grilling subagent chose any new name. Names are lowercase snake_case and generation-neutral. A cap at six would make the set closed in practice.

3. **What the known union lists.** The options were only the values that release's server emits, or all six from v2.0. The grilling subagent chose emitted values only, so the union never promises a value a client can't see.

4. **Meaning and mapping.** The options were a documented generation-neutral meaning per value with an internal flag mapping, or the flag mapping as the contract. The grilling subagent chose the documented meaning. A mapping fix toward the meaning is a bug fix. A change to a shipped meaning is not allowed within `/api/v2`. The main thread added that a meaning becomes contract when its value first ships.

5. **Array shape.** The options were unique and alphabetically sorted, unique in documented order, or no order. The grilling subagent chose unique and sorted, and named plain code-point order. The array is empty when no mode applies.

6. **Tests.** The options were excluding `modes` from the closed-enum test plus an append-only test, the exclusion alone, or an append-only test for every open enum. The grilling subagent chose the first. The last would decide a rule for other enums, which this ticket wasn't asked. After the audit, the main thread made the API package hold each known value with its meaning text, so the append-only test also catches a changed meaning.

7. **Viewer and unknown tags.** The options were showing an unknown tag as its raw string, or skipping it. The grilling subagent chose the raw string. That replaced its round 1 wording, which allowed either.

8. **Tags overlap.** The options were independent tags, where a battle carries every tag that holds, or mutually exclusive tags with a precedence order. The grilling subagent chose independent tags. A roaming Latias or Latios gets `legendary` and `roamer`. The only check on a new name is that its meaning isn't the same as, or a rename of, an existing one. This replaced its round 2 caveat about overlapping tags.

9. **Version bump.** The options were a minor release for a new value, or any release. The grilling subagent chose minor for the program and the API package, with the server emission, the union and the docs changing in the same release. The main thread added, after the audit, that a mapping fix is a patch of the program only, because the API package doesn't change.

10. **Other open enums.** The options were surfacing a ticket on whether any open enum may lose a value within `/api/v2`, or leaving §7.11 as it is. The grilling subagent chose to surface it. This ticket doesn't decide it.

11. **Spec citations.** The main thread mapped the amendment to the spec sections it replaces: §7.8 (`modes` bullet and fallbacks), §7.11, §11.4 and §12.7. The first draft cited §6 and §9 by mistake and was corrected before the audit.

## Audit

Round 1 returned four problems, all fixed:

- Item 3's example names (bug-catching contest, ghost) read as commitments. They are now marked as examples from the interview.
- Item 2 claimed §12.7 says "left out of the enum". It now names the exact §7.8 and §12.7 sentences, matching the replacement list.
- Item 4's rule against changing a shipped meaning had no check. The append-only test now compares meaning text too.
- Item 7 didn't say which artifact a mapping-fix patch bumps. It now says the program only. The package name was checked against `api/package.json`.

Round 2 returned one problem, fixed:

- The meaning check would also block a wording-only edit, and the amendment didn't say whether that was intended. It now says the strictness is deliberate, and any edit to a shipped meaning goes through its own amendment ticket.

Round 3 returned APPROVE.

## Surfaced

- **May an open enum lose a value within `/api/v2`?** A grilling ticket with no blockers. The API package build needs it before writing the contract docs.
