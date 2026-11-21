# Viewer Boxes screen: decision report

Ticket: Viewer Boxes screen. Spec: §11.5 and §7.9. Branch: `t3/viewer-boxes-screen`. Audit: Claude seat only. The Gemini and GPT seats are `n/a` (out of quota), so one Claude APPROVE passes the gate.

## Audit verdict

APPROVE at round 1. Claude seat 8, Gemini n/a, GPT n/a. Four minor problems, all declined.

## Decisions

1. **Whole resource or one box.** Question: how the screen loads boxes. Options: `GET /boxes` for the whole resource, or `GET /boxes/:n` per selected box. Choice: the whole resource. The box selector needs every name and readable flag anyway, and the server already limits box reads to once a second. Made by: implementer.

2. **Subscription.** Question: how to meet "subscribes to `boxes` only while it is open" before SSE exists. Choice: `useBoxes(enabled)` polls at the shared 1 s rate, enabled only when a game is identified and the route is Boxes. Made by: implementer.

3. **Empty versus corrupt.** Choice: a null slot listed in `corruptSlots` renders as a red "Slot n: corrupt" cell, and an unlisted null slot renders as a dashed "Empty" cell. A note under the grid counts the corrupt slots. Made by: implementer, from spec §7.9.

4. **Unreadable boxes.** Choice: the selector marks the box "(unreadable)", the grid is replaced by a note, and the name and wallpaper still show. The note says "save RAM access" for Gen 1-2 and "PC storage couldn't be decoded" for Gen 3. Made by: implementer.

5. **Staleness note.** Choice: shown for generation 1 or 2 only, taken from `status.game.generation`. Made by: implementer, from spec §7.9.

6. **Grid width.** Choice: 5 columns when a box has 20 slots, otherwise 6, so the grid follows the data. Made by: implementer.

7. **Mon card.** Choice: clicking a mon opens the existing `PartyCard` below the grid, which already shows null fields as `—`. The selection is tied to its box, so changing box or losing the box closes the card. Made by: implementer.

8. **Null names.** Choice: a null box name shows `Box <n>` counted from 1. A null wallpaper is hidden. Made by: implementer.

9. **No icons.** Choice: slots show the name and level as text. Spec §11.9 menu icons need the icon route, which no screen uses yet. Made by: implementer.

10. **Component tests.** Static markup only, as elsewhere in the viewer. A test-only `initial` prop sets the starting box and slot, because a static render has no clicks. Tests cover empty slots, a corrupt slot, an unreadable box (Gen 1-2 and Gen 3), a null name, a null wallpaper, null card fields, a selection in another box, loading and unavailable states, and the route gating. Made by: implementer.

11. **Compiled-executable test.** Choice: the existing `battle-executable.test.ts` also writes a synthetic Gen 3 storage block into the fake bridge's memory, and checks `GET /boxes` and `GET /boxes/1` against the compiled binary and the served viewer code for the Boxes screen. The block sits at EWRAM `0x30000`, above the battle structs. The first attempt at `0x20000` overwrote the battle block and failed the battle test. Made by: implementer.

12. **Shell test.** Choice: `shell.test.tsx` now expects a real Boxes screen, and uses Trainer & bag as its placeholder example. Made by: implementer.

## Minor problems declined

- `shell.test.tsx:155` checks only for "Boxes", which the old placeholder also contained. `BoxesScreen.test.tsx` ("opens the Boxes screen in a game") proves the real screen mounts.
- The test "a selection that belongs to another box opens no card" has two halves, and the first only checks the in-box case. The second half holds the no-card assertion. Naming only.
- The Gen 3 unreadable note names the storage block as the cause. Spec §7.9 gives that as the only Gen 3 cause ("a Gen 3 storage block fails to read").
- The screen never uses `/boxes/:n`. The ticket allows the whole resource.

## Surfaced

Nothing new. Box icons wait on the icon ticket.
