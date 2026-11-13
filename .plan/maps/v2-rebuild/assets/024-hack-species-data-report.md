# Decision report: Hack species data

Ticket: [Hack species data](../tickets/024-hack-species-data.md), a grilling ticket on the v2-rebuild map. Branch `t3/6f9dfd35`. The main thread ran the interview with the user through AskUserQuestion, using the grilling and domain-modeling skills. A sonnet subagent gathered the facts into [the research asset](./024-hack-species-data.md) with a 60-call cap and used 55 calls. A haiku subagent audited the resolution in three rounds. Round 1 raised eight objections and round 2 raised two. After round 2 the brief's stop rule halted the run, the user approved a third round, and round 3 returned APPROVE.

## Workflow notes

- The repo has no `workflow.md`, `AGENTS.md` or project `CLAUDE.md`, so the wayfinder-runner rules applied, as changed by the master's brief.
- Skipped gates: the Jev audit, which the parent session ran, and the step 5 commit question, which the master's brief replaced with "commit every time". Nothing merges to `main` from this branch.
- The map stays untouched. The master adds the Decisions line.
- CI: the repo has no `.github/workflows`, so the master's "no CI" rule applied and the Answer went into the ticket in the same run.
- The research correction about `gBaseStats 080001BC` needs no new ticket. [How ROM hacks extend reference data](../tickets/010-hack-reference-data.md) still holds, since CFRU does repoint other header words, and this ticket's Answer takes the `info` base from `find-rom-tables` output instead of trusting the header.

## Facts the questions rested on

From the research asset, which cites a source for each:

- CFRU's `BaseStats` keeps every vanilla offset: `genderRatio` at 0x10, `growthRate` at 0x13, and `abilities[2]` at 0x16 and 0x17, all u8. It adds a u8 `hiddenAbility` at 0x1A, which is padding in vanilla. Both strides are 0x1C, but no source states that size, so a ROM check must confirm it.
- CFRU's hidden-ability flag reuses vanilla's altAbility bit, bit 31 of the IV word in the misc substructure. When the flag is clear, CFRU picks ability slot 1 or 2 by `personality & 1`, not by that bit.
- The National Dex table is a u16 array indexed by species minus 1. Forms map to their base species' number. The GF header has no pointer to it. In CFRU builds the table comes from Dynamic Pokemon Expansion (DPE), and a literal-pool word at `0x0804323C` points to it.
- CFRU widens `gExperienceTables` to six rows of 256 u32 entries and keeps the vanilla order of the six growth rates. MAX_LEVEL defaults to 100 and a hack can raise it. Only literal pools point to the table.
- CFRU's NUM_SPECIES is 0x50E, and species IDs are u16.
- Correction to [the hack reference data research](./010-hack-reference-data.md): the `gBaseStats 080001BC` repoint line is in DPE's `repointall`, not CFRU's. A CFRU build without DPE may leave the header pointing at the vanilla table.

## Decisions

| # | Question | Options | Choice | Made by | Audit |
|---|---|---|---|---|---|
| 1 | Where do hack profiles get species data? | Read from ROM; per-hack JSON; keep `null` forever | Read from ROM, with locations in the profile (recommended) | User | APPROVE, round 3 |
| 2 | Must hack profiles declare it? | Required, with `"vanilla"` allowed; optional, where absent means `null` | Required (recommended) | User | APPROVE, round 3 |
| 3 | How is a boxed mon's level computed? | Growth rate plus curves kept in code; read the experience table from ROM | Curves in code (recommended). Decision 9 revised this | User | APPROVE, round 3 |
| 4 | Which dex number do forms get? | Base species' number; `null` | Base species' number, and an entry of 0 gives `null` (recommended) | User | APPROVE, round 3 |
| 5 | Where does the entry layout live? | Data-format code; the profile | Data-format code, with `{ base, count }` in the profile (recommended) | User | APPROVE, round 3 |
| 6 | What shape does the profile block take? | `speciesData { info, dex }`; one combined key | Separate keys (recommended). Decision 11 added `exp` | User | APPROVE, round 3 |
| 7 | What happens when a table fails? | `null` plus a status enum; vanilla fallback | `null` with no fallback, and `status.game.speciesData` (recommended) | User | APPROVE, round 3 |
| 8 | How strict is validation? | Whole-table checks; per-entry checks | Whole-table checks, discarding a failing table whole (recommended) | User | APPROVE, round 3 |
| 9 | What happens for levels above 100? | Cap at 100 and give `null` above it; a `maxLevel` profile field with formula curves; read the experience table from ROM | Read the experience table from ROM. The user picked this over the recommended cap, which revises decision 3 | User | APPROVE, round 3 |
| 10 | Who finds the addresses? | Extend the dev script; a separate script; by hand | Rename `scripts/find-name-tables` to `find-rom-tables` and extend it (recommended) | User | APPROVE, round 3 |
| 11 | How does a profile declare the experience table? | `exp { base, maxLevel }`, required; optional `exp`; `exp { base, rowLength, maxLevel }` | `exp { base, maxLevel }`, required, with row length in code (recommended) | User | APPROVE, round 3 |
| 12 | How is the experience table validated? | Rows that never decrease, `null` on failure; fall back to the code curves | Rows that never decrease, `null` on failure, and `null` for experience above the `maxLevel` threshold (recommended) | User | APPROVE, round 3 |
| 13 | Does status report the experience table? | Three keys; fold it into `info` | `status.game.speciesData { info, dex, exp }` (recommended) | User | APPROVE, round 3 |
| 14 | Does the summary match the user's understanding? | Yes; change something | Yes | User | n/a |
| 15 | How is the dex table indexed? | By species minus 1; by species | Entry `i` is species `i + 1`, as in the decomps, so `count` is NUM_SPECIES minus 1 | Main thread, from research | APPROVE, round 3 |
| 16 | What bounds an ability ID during validation? | The abilities name table's `count`; a fixed number | The abilities name table's `count` when it is a ROM table, otherwise the vanilla Gen 3 ability count. `hiddenAbility` is checked too on CFRU | Main thread | APPROVE, round 3 |
| 17 | How does experience become a level? | The game's `GetLevelFromBoxMonExp` loop; nearest threshold | pokefirered's loop ([src/pokemon.c L2196-L2205](https://github.com/pret/pokefirered/blob/ce6406d8c2/src/pokemon.c#L2196)), capped at `maxLevel`, after a first check that gives `null` for experience above the `maxLevel` threshold (decision 12). That CFRU uses the same routine is inferred | Implementer, after audit objection 2 | APPROVE, round 3 |
| 18 | What thresholds does validation use? | Named constants; fixed literals | The 90% share constant from ROM hack name tables for both tables, and a `MAX_NATIONAL_DEX` constant set to 1025, both rechecked when a real hack ROM is checked | Main thread | APPROVE, round 3 |
| 19 | When do species tables load? | With the name tables; lazily | In the same window as the name tables, before `game`. A failed table doesn't hold the state back. Each table fits in one 64 KiB read | Main thread, confirmed by the user after audit objection 8 | APPROVE, round 3 |
| 20 | What do official profiles report? | `"builtin"` everywhere; `null` where a generation lacks a field | `"builtin"` for all three keys in every generation. The enum has no `null`, because every generation uses some species data | Main thread, confirmed by the user after audit objection 8 | APPROVE, round 3 |
| 21 | Where does a hack profile's `info` base come from? | The header pointer; the finder's output | The finder's output. The `ptr` form is allowed when the owner confirms the header was repointed, because a CFRU build without DPE may leave it on the vanilla table | Main thread, from the research correction | APPROVE, round 3 |
| 22 | What level does a box mon get when its experience is below the level-1 entry? The game returns 0 | `null`; 0, as the game does; floor at 1 | `null` (recommended) | User, after audit objection 2 | APPROVE, round 3 |
| 23 | Which ability rule does each decoder use? | Spell out both; CFRU only | Gen 3 uses the stored bit as the slot. CFRU takes the hidden ability when the bit is set and `hiddenAbility` is non-zero, otherwise slot 1 when `personality & 1` is 0 or slot 2 is empty, otherwise slot 2 | Implementer, after audit objections 3 and 4 | APPROVE, round 3 |
| 24 | What counts as a missing table? | A `base` outside cartridge space; nothing beyond a failed read | A `base` that doesn't resolve into `0x08000000`-`0x09FFFFFF`, or a table whose last byte lies beyond `0x09FFFFFF`, counts as a failed table | Implementer, after audit objection 5 | APPROVE, round 3 |
| 25 | How do large tables load? | Chunks of at most 64 KiB, as name tables do; reject a table over 64 KiB | Chunks, with `count` capped at 65535 by the schema | Implementer, after audit objection 7 | APPROVE, round 3 |
| 26 | Is the 0x1C stride confirmed? | Confirmed; inferred | Inferred. A ROM fixture must confirm it before the Gen 3 or CFRU decoder ships | Implementer, after audit objection 6 | APPROVE, round 3 |

## Resolution text

The Answer is recorded in [the ticket](../tickets/024-hack-species-data.md).
