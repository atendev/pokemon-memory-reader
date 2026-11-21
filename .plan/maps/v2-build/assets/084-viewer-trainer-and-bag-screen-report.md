# Viewer Trainer and bag screen: decision report

Ticket: Viewer Trainer and bag screen. Spec: §11.6 and amendment 017. Branch: `t3/viewer-trainer-bag-screen`. Audit: Claude seat only. The Gemini and GPT seats are `n/a` (out of quota), so one Claude APPROVE passes the gate.

## Audit verdict

APPROVE at round 1. Claude seat 8, Gemini n/a, GPT n/a. Two minor problems, both declined.

## Decisions

1. **Loading.** Question: how the screen gets `player` and `bag`. Choice: two hooks, `usePlayer` and `useBag`, that poll at the shared 1 s rate and run only while a game is identified and the route is Trainer & bag, the same pattern as Boxes. Each resource loads on its own, so a failing bag leaves the trainer card showing. Made by: implementer.

2. **Badge rows.** Question: how to fit Gen 2's sixteen badges, which spec §11.6 leaves open. Options: one scrolling row, a shrunken row, or rows of eight. Choice: rows of eight, so Gen 1 and Gen 3 get one row and Gen 2 gets two. A sixteen-badge player's rows are labelled Johto and Kanto, following the order amendment 017 §3 sets. Made by: implementer.

3. **Badge state.** Choice: each badge shows "Obtained" or "Not yet" in text and also changes border style, so colour is not the only cue. A heading counts them ("2 of 8"). A badge with a null name (a hack profile) prints `Badge <n>`, counted from 1. Made by: implementer.

4. **Hidden fields.** Choice: a null or empty `name` and a null `secretId` render no row and no label. The schema types `name` as a string, so the screen treats a null name defensively, as the ticket asks. Made by: implementer.

5. **Formatting.** Choice: IDs pad to five digits (`00007`), money prints as `₽4,200` in a fixed `en-US` locale, and play time prints as `hours:mm:ss` with unbounded hours and no frames, per amendment 017 §2. Made by: implementer.

6. **Location.** Choice: the area name is the section name, `#<id>` when the section has no name, and "Unknown area" when the section is null. A second line gives the raw map as `Map 0:9` plus `x` and `y`. Gen 1 has no map group, so it prints `Map 9`. Made by: implementer, from amendment 017 §4.

7. **Pockets.** Choice: one card per pocket in game order, headed by the pocket name with `used / capacity`. An empty pocket says "Empty". A pocket whose stacks fill every slot reads "· Full" and gets an orange border. A null item name prints `#<id>`, and a quantity of 0 in a slot pocket still shows, since the decoder keeps it. An unknown pocket ID prints as itself. Made by: implementer.

8. **No item icons.** Spec §11.6 asks for item icons. The icon system is [Viewer icons and packs](../tickets/087-viewer-icons-and-packs.md), which has not landed, so the screen shows names as text, as Boxes did. A follow-up ticket adds them. Made by: implementer.

9. **Tests.** Component tests use static markup. They cover obtained and missing badges, sixteen badges, a nameless badge, an empty pocket, a full pocket, one short of full, an unknown item name, a quantity of 0, a null secret ID, a null and empty name, a null section, Gen 1 location, each resource loading or failing alone, and the route gating. A separate file tests the formatting helpers. `shell.test.tsx` now uses Settings as its placeholder example. Made by: implementer.

10. **Compiled-executable test.** Choice: `battle-executable.test.ts` writes a synthetic player and bag into the fake bridge's memory with the existing `writePlayer` and `writeBag`, checks `/api/v2/player` and `/api/v2/bag` against the compiled binary, and checks the served viewer code for the screen's strings. The synthetic PC box block moved from `0x30000` to `0x37400`, because `gMapHeader` at `0x37318` sat inside the old block and the player's section read would have hit box bytes. The new block ends at `0x3F7D0`, inside the 0x40000 EWRAM. Made by: implementer.

## Minor problems declined

- The Claude seat could not see the `--green`, `--orange`, `--surface-2`, `--separator` and `--label-2` custom properties in the diff. All five are defined in `:root` in `viewer/src/styles.css`.
- A quantity-0 stack counts toward "Full" and a test pins it. The decoder skips empty slots (item ID 0) and keeps a stack with quantity 0, so a quantity-0 stack does occupy a slot.

## Surfaced

Item icons on the Trainer & bag screen, blocked by the viewer icons ticket (087).
