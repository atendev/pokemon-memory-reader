# Decision report: Do these text mismatches read the way the spec shows them?

Ticket: [025-spec-text-mismatches](../tickets/025-spec-text-mismatches.md). Amendment: [025-spec-text-mismatches](./025-spec-text-mismatches.md). Type: grilling.

## How it ran

The main thread put the five mismatches from spec §17 item 13 to the owner in one AskUserQuestion round. The owner chose the runner's Auto mode for every question. Under Auto mode, the main thread wrote each question with options and a recommendation, and a sonnet grilling subagent answered it. That took two rounds. A haiku auditor checked the amendment and approved it in round 2. No research subagent ran, because every fact came from spec.md and the source tickets.

## Decisions

| # | Question | Options | Choice | Made by | Audit |
|---|---|---|---|---|---|
| 1 | Do official profiles read from ROM? Ticket 020 says nothing, while 012, 014 and 023 read trainer tables and signature words. | (a) no names from ROM, but header, signature words and trainer tables are read. (b) nothing from ROM. | (a), matching the wording §5.5 already uses. | Main thread recommended, grilling subagent accepted. | Approved round 1 |
| 1a | What happens when the adapter can't read ROM? | (a) trainer tables count as missing, so their fields are null and the signature is `"unchecked"`. (b) a new status flag. | (a), which reuses the null rule in §5.1 and §7.8. | Grilling subagent raised it, main thread recommended, grilling subagent accepted. | Approved round 1 |
| 2 | How do 012's per-battle warning and 018's 2 s warning combine? | (a) one warning after 2 s of consecutive failures, at most once per flag-set period. (b) both rules. (c) warn on the first failure, once per battle. | (a). Normal invalid frames at battle start would log every battle under (c). The period keys on the flag, because `battleId` only increments on going active. | Main thread recommended, grilling subagent accepted and added that the rule applies whether or not the resource is active yet. | Round 1 asked for the replaced text to be named. Approved round 2 |
| 2a | Where does 018's "count it" go? | (a) the existing validation-failure counter at `/debug/metrics`. (b) a public status field. | (a). Public `status` gains only `stalled` (§8.10). | Grilling subagent raised it, main thread recommended, grilling subagent accepted. | Approved round 1 |
| 3 | What values does `status.game.signature` take? | (a) `match`, `mismatch`, `unchecked`, `null`. (b) drop `unchecked`. | (a). Manual picks without ROM reads need `unchecked` to drive the viewer warning. | Main thread recommended, grilling subagent accepted. | Round 1 asked to cite §5.4 and ticket 023 correctly. Approved round 2 |
| 4 | Does the Gen 1-2 `unknown` fallback cover the Gen 1 `0xFF` end marker? | (a) yes, `unknown` until confirmed. (b) map to `lost` now. | (a). The battle still ends at once, and only the outcome value waits. | Main thread recommended, grilling subagent accepted. | Approved round 2 |
| 4a | What confirms the marker? | (a) the Gen 1 `0xFF` sequence fixture from §12.5, captured after a known loss and expecting `lost`. (b) that fixture expects `unknown`, and a separate savestate confirms `lost`. | (a). The fixture is real evidence, and (b) leaves an expected value that goes stale when the fixture lands. The expected value must not come from decoder output. | Main thread recommended, overriding the grilling subagent's round 1 suggestion. Grilling subagent accepted. | Round 1 found that the "§12.7 lost savestate check for the marker" did not exist. The amendment now adds a marker gate to §12.7 as an explicit change. Approved round 2 |
| 4b | Does the fallback lift once for Gen 1-2 or per data format? | (a) per data format. (b) one joint switch. | (a). §12.7's joint `wBattleResult` gate splits into a Gen 1 gate and a Gen 2 gate, and the prize-formula gate stays joint. | Main thread recommended, grilling subagent accepted. Main thread scoped the prize gate out. | Round 1 asked to label this a change to §12.7. Approved round 2 |
| 5 | Do the later tickets replace 013's box cadence and caps? | (a) yes, drop the GDB stub, 512-byte cap, chunking and 2 s cadence. (b) keep the 2 s cadence. | (a). Boxes follow §8.3 (1000 ms), the §4.4 caps, and ticket 026's load-time cap check. | Main thread recommended, grilling subagent accepted. | Approved round 1 |

## Audit

- Round 1 returned six objections. Three mattered: an invented §12.7 marker check, the per-format split stated as existing spec, and an unclear §7.4 and ticket 023 citation. The other three were the replaced §7.8 text going unnamed, an off-by-one line citation that the amendment didn't use, and the date. The main thread fixed all six and also stated that the "Amended by" pointers are future work.
- Round 2 returned APPROVE. The auditor did not read tickets 006, 012, 013, 018, 020 or 023. Their quoted text comes from the main thread's reads.

## Left open

- None for this ticket. When the spec text is next updated, §5.4, §5.5, §7.4, §7.8, §8.3, §8.6, §12.5 and §12.7 cite the amendment, and the overridden source tickets get "Amended by" pointers.
