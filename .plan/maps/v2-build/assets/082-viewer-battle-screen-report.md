# Viewer Battle screen: decision report

Ticket: Viewer Battle screen. Spec: §11.4. Branch: `t3/viewer-battle-screen-1`. Audit: Claude seat only, Gemini and GPT seats skipped (out of quota). Approval rests on the Claude seat.

## Audit verdict

APPROVE at round 3. Claude seat 8. Gemini and GPT seats skipped (out of quota).

| Round | Verdict | Score | Result |
| --- | --- | --- | --- |
| 1 | DISAPPROVE | 7 | One blocking problem: an unrevealed opponent active battler showed species and moves. Fixed in `0378f26`. |
| 2 | DISAPPROVE | 6 | One blocking problem: `isHiddenBattler` failed open on a null `partySlot` or a slot with no party entry. One minor: no render test for the show-on case. Both fixed in `6141a8c`. |
| 3 | APPROVE | 8 | One minor, declined. |

## Decisions

1. **What the screen reads.** Question: which resources feed the screen. Options: `battle` only, or `battle` plus `field` and `lastBattle`. Choice: the `battle` resource, which carries `field` when active and `lastBattle` when inactive, as spec §11.4 says. Made by: implementer.

2. **Unrevealed tiles in the opponent party.** Question: how a hidden mon renders. Choice: a `?` tile in place, with a ball label and no species, level, HP or moves. The tile count matches the game's party-size balls. Made by: implementer, from spec §11.4.

3. **The show-unrevealed setting.** Question: where it lives and how a page can override it. Options: `config.json`, or localStorage with a URL override. Choice: localStorage, key `pmr.showUnrevealed`, off by default. `?showUnrevealed=1` or `=0` overrides it for one page load and is never written to storage, so an OBS browser source can't change what the owner's browser remembers. The checkbox is disabled with an explanation while an override is active. Made by: implementer, from the spec's "What is a setting" rule.

4. **Active opponent battler.** Question: what an unrevealed opponent battler in `opponent.active` shows. Options: show it, since it is on the field, or hide it like a tile. Choice: hide it (`HiddenBattlerCard`, no species, level or moves). The API can list an unrevealed party mon as active before the revealed flag catches up, and the acceptance criterion says no species, level or moves anywhere in the DOM. Made by: council seat (round 1), fixed by implementer.

5. **Fail closed.** Question: what `isHiddenBattler` does when it can't match a battler to a party mon. Choice: hide it. A null `partySlot` or a slot with no party entry hides the battler unless the setting is on, matching the party tiles (`mon.revealed || show`). Wild mons stay visible because they are always revealed. Made by: council seat (round 2), fixed by implementer.

6. **Pokémon left.** Choice: per trainer, the count of mons with HP above 0, revealed or not (spec §11.4). Null HP counts as alive, pinned by a test. Made by: implementer.

7. **Field.** Choice: badges for shared, player-side and opponent-side field conditions, in three groups. Made by: implementer.

8. **Last battle.** Choice: when no battle is active, show a summary card from `lastBattle`. Made by: implementer.

9. **Compiled-executable test.** Question: how to meet "runs against the fake bridge in the compiled executable". Choice: `server/test/e2e/battle-executable.test.ts` starts the compiled binary on the fake bridge with a wild battle, gated on `PMR_EXECUTABLE`, plus a step in the compile-smoke job of `ci.yml`. Made by: implementer.

10. **Tests.** Component tests cover an inactive state with a `lastBattle`, a wild battle, a trainer battle with unrevealed mons, and a double battle, plus hidden-battler cases (setting off, setting on through the page address, null and missing slot). The show-on render test stubs `window.location` in `withLocation`. Made by: implementer.

## Minor problems declined

- No sprites or type icons. No icon system exists yet and the Party screen has none either. Candidate follow-up when the icon ticket lands.
- Null HP counts as alive. Intended, and pinned by a test.
- The hidden active tile gets no highlight. A highlight would reveal which slot is active.
- Round 3: the show-on render test depends on the hook reading `window.location`, and no test pins a wild battler staying visible with the setting off. The first is a test stub that passes against the real hook. The second is covered by the wild battle test, which renders the revealed wild mon with the setting off.

## Checks

`bun test` in `viewer`: 92 pass. Lint and typecheck clean. `server/test/e2e/battle-executable.test.ts` passes locally against the compiled executable. `server/test/bridge/core.test.ts` fails its Lua version check on this host (default `lua` is 5.5, CI uses 5.4). That failure predates this ticket.
