# Consolidated v2 spec: decision report

Ticket: [Consolidated v2 spec](../tickets/001-consolidated-spec.md) (task). Output: [`../../v2-rebuild/spec.md`](../../v2-rebuild/spec.md).

## Run

- The parent wayfinder-master session ran the Jev audit, so this child skipped it.
- The routing named pstack `/why` and `/blast-radius`. Neither applied. The ticket only consolidates text, its evidence is the 24 resolved tickets, and it changes no code.
- The master's overrides replaced the runner's commit gate and merge question. This report is committed with the work, and the branch never merges.
- One haiku auditor reviewed the spec. It returned APPROVE in round 5 of 5. Rounds 1 to 4 found 25, 3, 1 and 1 problems, and the round 4 item was only a pointer it couldn't see within its tool budget.

## Decisions

| # | Question | Options | Choice | Made by | Audit |
|---|---|---|---|---|---|
| 1 | How is the spec laid out? | The ticket's suggested sections; one section per ticket | 14 numbered subsystem sections from the ticket's suggested list, then implementation spikes (§15), a decision index (§16) and conflicts and gaps (§17). Build tickets cite "§N.M" | Implementer | Accepted |
| 2 | How much asset content goes in? | Fold whole assets; fold only what a builder needs and link the rest | Fold the facts a builder needs, such as RetroArch's core memory maps, and link each asset from its section | Implementer | Accepted |
| 3 | When tickets contradict and a section must show one value, what does it show? | Leave the value blank; show both; show the deciding ticket's text and point to §17 | Show the deciding ticket's text, mark it in place and point to §17. Round 1 flagged lines that said "the spec follows" a ticket, and those now only point to §17 | Implementer, revised after audit item 1 | Accepted after revision |
| 4 | Does the spec cite the build map's Emulator Lua runtimes decision? | Leave it out, since it isn't a v2-rebuild ticket; cite it | Cite it in §4.9 and §13.2 as a later build-map decision, without folding it into a v2-rebuild section | Implementer | Accepted |
| 5 | What license does each workspace package carry? | Leave it unstated; derive it from License | GPL-3.0-or-later for `server/`, `viewer/` and `bridges/`, MIT for `api/`, and `internal/` never published. This follows License's rule that only packages meant for outside import are MIT | Implementer | Accepted |
| 6 | How are open questions grouped in §17? | One item per gap; group related questions | 15 items, each a candidate grilling ticket with a "Needed by" line. Related questions share an item: identification details in item 2, and the Pokémon schema with Gen 1 `shiny` and the type enum in item 4 | Implementer | Accepted |
| 7 | Do the low-weight text mismatches each get a ticket? | One ticket each; one grouped item | One grouped item (item 13) with a Needed by line. The auditor suggested splitting it, and I kept it grouped because each bullet is a text mismatch, not a design question | Implementer | Not raised again after round 1 |
| 8 | Which of my own drafting choices went past the tickets? | Keep them; cut them | A self-review before the audit cut five: "each instance with its own data folder", Zod major 4 for the server, extra Settings fields, a CFRU box fixture in tier 2, and the notices check placed in `ci.yml` | Implementer | Accepted |
| 9 | When does header matching apply if the emulator supplied a hash? | Leave it to §17; state the rule from Game identification | State it. Game identification's "Uncertain matches" bullet already says that a supplied hash that matches nothing makes the ROM modified, so header matching applies only without a hash | Implementer, after audit item 6 | Accepted |
| 10 | Does the spec list the license allowlist IDs that "and similar" covers? | List them; open a §17 item | Open §17 item 15. Choosing the IDs would be a new decision | Implementer, after audit item 24 | Accepted |
| 11 | Do the RetroArch probe rule and oversize merged batches get a rule? | Write one; open a §17 item | Open §17 item 14. No ticket decides either | Implementer, after audit items 22 and 23 | Accepted |
| 12 | Does "checked against fixtures" for built-in hack profiles stay? | Replace it with `test:local`; keep it with a note | Keep ROM hack name tables' wording, and add that fixtures hold no ROM bytes, so ROM tables are checked by synthetic tests and `test:local` | Implementer, after audit item 13 | Accepted |
| 13 | Does "about 0.25-1 s per game load" need a source? | Cut it; keep it | Keep it. ROM hack name tables gives the figure, and §5 lists that ticket | Implementer, after audit item 25 | Accepted |

## Round 1 findings applied

The auditor returned 25 items and no APPROVE. I accepted 22 as written and 3 with the changes in rows 10, 12 and 13:

- Source lines for §15, §16 and §17, plus 011 for §7 and 009 for §9.
- Question headlines for every §17 item.
- Fixes for internal mismatches:
  - unknown_bridge versus protocol_mismatch
  - the scope of "no address finder"
  - Hack species data's correction of the CFRU repoint claim
  - `nature` moved to the open list
  - `features.boxes` stated per profile
  - the type enum wording
  - lookups outside a valid species table
  - v1's license history
  - x64-only platform support
  - the API package's release-candidate timing
  - Gen 1-2 single format
  - the Gen 2 16-badge note
  - the header timer's unset interval
- A new §17 bullet: whether the Gen 1-2 outcome fallback covers Gen 1's `0xFF` end marker.

## Round 2 findings applied

The auditor confirmed the 25 round 1 fixes and returned 3 more:

- §5.4 had folded Hack species data's correction of the CFRU repoint as settled. It now states both tickets' claims, and §17 item 11 asks whether the signature still catches CFRU builds without DPE. Round 3 moved that question from item 13 to item 11, because it is a design gap, not a text mismatch.
- §14 now attributes the v1 license conflict to License's question text. The auditor also asked for a §17 item on the README's v1 sentence. I declined, because License decides that sentence word for word.
- §4.7's unknown_bridge sentence was reworded so a protocol difference reads clearly as `protocol_mismatch`.

## Surfaced tickets

All are grilling tickets with no blockers. Each matches one §17 item.

1. How do profiles write addresses?
2. How are ROMs keyed and re-identified?
3. Is `battle.modes` an open enum?
4. What is the full Pokémon schema?
5. What shapes do `player` and `bag` have?
6. What else does the profile schema hold?
7. Where does reference data come from?
8. What fills the unset status and error details?
9. Which routes serve the viewer's controls and info?
10. What happens to signatures for revisions the owner doesn't own?
11. How is the species-info layout confirmed, and does the signature still catch CFRU builds without DPE?
12. How do prereleases ship while main stays untouched?
13. Do these text mismatches read the way the spec shows them?
14. How is RetroArch probed, and what happens when a batch is too big?
15. Which licenses does the third-party allowlist accept?
